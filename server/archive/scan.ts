import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type { ArchiveListResponse, ArchivedSession } from '@shared/archive'
import type { SessionDetail } from '@shared/types'
import { historyAt } from '../sources/history'
import { baseNameOf, localFacts } from '../sources/local-facts'
import { readTail } from '../sources/transcripts'

const DEFAULT_PROJECTS_DIR = join(homedir(), '.claude', 'projects')
const TRANSCRIPT_SUFFIX = '.jsonl'
const FALLBACK_TITLE = 'Claude'
const ARCHIVE_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/
const SCAN_BATCH_SIZE = 8

export const MAX_LRU_ENTRIES = 200
export const DEFAULT_ARCHIVE_LIMIT = 30
export const MIN_ARCHIVE_LIMIT = 1
export const MAX_ARCHIVE_LIMIT = 50

export type ArchiveQuery = {
  q?: string
  repo?: string
  limit?: number
}

export type ArchiveScannerOptions = {
  projectsDir?: string
  maxCacheEntries?: number
}

export type ArchiveScanner = {
  list(query: ArchiveQuery, activeIds: ReadonlySet<string>): Promise<ArchiveListResponse>
  readSession(id: string): Promise<SessionDetail | null>
  cacheSize(): number
}

type ScannedFile = {
  id: string
  path: string
  modifiedAt: number
  size: number
}

type SessionMetadata = {
  title: string
  repo: string | null
}

export function isValidArchiveId(id: string): boolean {
  if (!ARCHIVE_ID_PATTERN.test(id)) {
    return false
  }
  return id !== '.' && !id.includes('..')
}

export function clampArchiveLimit(rawLimit: string | null | undefined): number {
  if (!rawLimit) {
    return DEFAULT_ARCHIVE_LIMIT
  }
  const parsed = Number(rawLimit)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_ARCHIVE_LIMIT
  }
  return Math.min(MAX_ARCHIVE_LIMIT, Math.max(MIN_ARCHIVE_LIMIT, Math.floor(parsed)))
}

export function filterArchiveSessions(sessions: ArchivedSession[], query: ArchiveQuery): ArchiveListResponse {
  const needle = (query.q ?? '').trim().toLowerCase()
  const repoFilter = (query.repo ?? '').trim()
  const filtered = sessions.filter((session) => {
    if (repoFilter && session.repo !== repoFilter) {
      return false
    }
    if (!needle) {
      return true
    }
    const titleMatch = session.title.toLowerCase().includes(needle)
    const repoMatch = session.repo !== null && session.repo.toLowerCase().includes(needle)
    return titleMatch || repoMatch
  })
  const sorted = [...filtered].sort((first, second) => {
    if (second.modifiedAt !== first.modifiedAt) {
      return second.modifiedAt - first.modifiedAt
    }
    return first.id.localeCompare(second.id)
  })
  const limit = Math.min(MAX_ARCHIVE_LIMIT, Math.max(MIN_ARCHIVE_LIMIT, Math.floor(query.limit ?? DEFAULT_ARCHIVE_LIMIT)))
  const sliced = sorted.slice(0, limit)
  return {
    sessions: sliced,
    total: sorted.length,
    truncated: sorted.length > sliced.length
  }
}

export function createMetadataLru(maxEntries = MAX_LRU_ENTRIES): {
  get(key: string): SessionMetadata | undefined
  set(key: string, value: SessionMetadata): void
  size(): number
} {
  const entries = new Map<string, SessionMetadata>()
  const limit = Math.max(1, maxEntries)

  function get(key: string): SessionMetadata | undefined {
    const value = entries.get(key)
    if (value === undefined) {
      return undefined
    }
    entries.delete(key)
    entries.set(key, value)
    return value
  }

  function set(key: string, value: SessionMetadata): void {
    if (entries.has(key)) {
      entries.delete(key)
    }
    entries.set(key, value)
    while (entries.size > limit) {
      const oldest = entries.keys().next().value
      if (oldest === undefined) {
        break
      }
      entries.delete(oldest)
    }
  }

  return {
    get,
    set,
    size: () => entries.size
  }
}

async function statOrNull(filePath: string): Promise<{ mtimeMs: number; size: number } | null> {
  try {
    const info = await stat(filePath)
    return { mtimeMs: info.mtimeMs, size: info.size }
  } catch {
    return null
  }
}

async function scanDirectoryFiles(projectsDir: string): Promise<ScannedFile[]> {
  const folders = await readdir(projectsDir, { withFileTypes: true }).catch(() => [])
  const byId = new Map<string, ScannedFile>()
  for (const folder of folders) {
    if (!folder.isDirectory()) {
      continue
    }
    const folderPath = join(projectsDir, folder.name)
    const names = await readdir(folderPath).catch(() => [])
    const discovered = await Promise.all(
      names
        .filter((name) => name.endsWith(TRANSCRIPT_SUFFIX))
        .map(async (name): Promise<ScannedFile | null> => {
          const id = basename(name, TRANSCRIPT_SUFFIX)
          if (!isValidArchiveId(id)) {
            return null
          }
          const path = join(folderPath, name)
          const info = await statOrNull(path)
          if (!info) {
            return null
          }
          return { id, path, modifiedAt: info.mtimeMs, size: info.size }
        })
    )
    for (const file of discovered) {
      if (!file) {
        continue
      }
      const existing = byId.get(file.id)
      if (!existing || file.modifiedAt > existing.modifiedAt) {
        byId.set(file.id, file)
      }
    }
  }
  return [...byId.values()].sort((first, second) => {
    if (second.modifiedAt !== first.modifiedAt) {
      return second.modifiedAt - first.modifiedAt
    }
    return first.id.localeCompare(second.id)
  })
}

async function mapInBatches<T, R>(items: T[], batchSize: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (let offset = 0; offset < items.length; offset += batchSize) {
    const slice = items.slice(offset, offset + batchSize)
    const resolved = await Promise.all(slice.map(worker))
    results.push(...resolved)
  }
  return results
}

export function createArchiveScanner(options: ArchiveScannerOptions = {}): ArchiveScanner {
  const projectsDir = options.projectsDir ?? DEFAULT_PROJECTS_DIR
  const lru = createMetadataLru(options.maxCacheEntries ?? MAX_LRU_ENTRIES)

  async function metadataFor(file: ScannedFile): Promise<SessionMetadata> {
    const key = `${file.path}:${file.modifiedAt}:${file.size}`
    const cached = lru.get(key)
    if (cached) {
      return cached
    }
    const tail = await readTail(file.path, file.size).catch(() => null)
    if (tail === null) {
      return { title: FALLBACK_TITLE, repo: null }
    }
    const facts = localFacts(tail.split('\n'))
    const metadata: SessionMetadata = {
      title: facts.title ?? FALLBACK_TITLE,
      repo: facts.cwd ? baseNameOf(facts.cwd) : null
    }
    lru.set(key, metadata)
    return metadata
  }

  async function toArchivedSession(file: ScannedFile, activeIds: ReadonlySet<string>): Promise<ArchivedSession> {
    const metadata = await metadataFor(file)
    return {
      id: file.id,
      title: metadata.title,
      repo: metadata.repo,
      modifiedAt: file.modifiedAt,
      size: file.size,
      active: activeIds.has(file.id)
    }
  }

  async function list(query: ArchiveQuery, activeIds: ReadonlySet<string>): Promise<ArchiveListResponse> {
    const files = await scanDirectoryFiles(projectsDir)
    const hasFilter = Boolean((query.q ?? '').trim() || (query.repo ?? '').trim())
    const limit = Math.min(MAX_ARCHIVE_LIMIT, Math.max(MIN_ARCHIVE_LIMIT, Math.floor(query.limit ?? DEFAULT_ARCHIVE_LIMIT)))
    if (!hasFilter) {
      const topFiles = files.slice(0, limit)
      const sessions = await mapInBatches(topFiles, SCAN_BATCH_SIZE, (file) => toArchivedSession(file, activeIds))
      return {
        sessions,
        total: files.length,
        truncated: files.length > sessions.length
      }
    }
    const allSessions = await mapInBatches(files, SCAN_BATCH_SIZE, (file) => toArchivedSession(file, activeIds))
    return filterArchiveSessions(allSessions, { ...query, limit })
  }

  async function readSession(id: string): Promise<SessionDetail | null> {
    if (!isValidArchiveId(id)) {
      return null
    }
    const files = await scanDirectoryFiles(projectsDir)
    const match = files.find((file) => file.id === id)
    if (!match) {
      return null
    }
    const entries = await historyAt(match.path)
    if (entries === null) {
      return null
    }
    return { id, entries, screen: null }
  }

  return {
    list,
    readSession,
    cacheSize: lru.size
  }
}
