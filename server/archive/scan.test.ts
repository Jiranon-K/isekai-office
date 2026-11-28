import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ArchivedSession } from '@shared/archive'
import {
  clampArchiveLimit,
  createArchiveScanner,
  createMetadataLru,
  filterArchiveSessions,
  isValidArchiveId,
  MAX_LRU_ENTRIES
} from './scan'

let folder = ''
let projectsDir = ''

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'isekai-archive-'))
  projectsDir = join(folder, 'projects')
  mkdirSync(projectsDir, { recursive: true })
})

afterEach(() => {
  rmSync(folder, { recursive: true, force: true })
})

function writeTranscript(projectFolder: string, id: string, title: string, cwd: string, prompt: string, mtimeMs?: number): void {
  const dir = join(projectsDir, projectFolder)
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `${id}.jsonl`)
  const lines = [
    JSON.stringify({ type: 'user', cwd, timestamp: '2026-11-28T10:00:00.000Z', message: { content: prompt } }),
    JSON.stringify({ type: 'ai-title', aiTitle: title }),
    JSON.stringify({ type: 'assistant', timestamp: '2026-11-28T10:01:00.000Z', message: { content: [{ type: 'text', text: 'Done.' }] } })
  ]
  writeFileSync(filePath, `${lines.join('\n')}\n`)
  if (mtimeMs !== undefined) {
    const stamp = new Date(mtimeMs)
    utimesSync(filePath, stamp, stamp)
  }
}

describe('isValidArchiveId and clampArchiveLimit', () => {
  test('accepts safe IDs and rejects empty, traversal, slashes, and overly long IDs', () => {
    expect(isValidArchiveId('arch-1')).toBe(true)
    expect(isValidArchiveId('session_2026.01-abc')).toBe(true)
    expect(isValidArchiveId('')).toBe(false)
    expect(isValidArchiveId('.')).toBe(false)
    expect(isValidArchiveId('..')).toBe(false)
    expect(isValidArchiveId('../secret')).toBe(false)
    expect(isValidArchiveId('foo..bar')).toBe(false)
    expect(isValidArchiveId('a/b')).toBe(false)
    expect(isValidArchiveId('a\\b')).toBe(false)
    expect(isValidArchiveId('has space')).toBe(false)
    expect(isValidArchiveId('x'.repeat(129))).toBe(false)
  })

  test('clamps limit to 1..50 and defaults to 30', () => {
    expect(clampArchiveLimit(null)).toBe(30)
    expect(clampArchiveLimit('')).toBe(30)
    expect(clampArchiveLimit('abc')).toBe(30)
    expect(clampArchiveLimit('0')).toBe(1)
    expect(clampArchiveLimit('-10')).toBe(1)
    expect(clampArchiveLimit('12')).toBe(12)
    expect(clampArchiveLimit('500')).toBe(50)
  })
})

describe('filterArchiveSessions', () => {
  const sample: ArchivedSession[] = [
    { id: 's1', title: 'Checkout Flow', repo: 'web-app', modifiedAt: 100, size: 10, active: false },
    { id: 's2', title: 'Rate Limiter', repo: 'api', modifiedAt: 300, size: 20, active: true },
    { id: 's3', title: 'API Docs Cleanup', repo: 'docs', modifiedAt: 200, size: 30, active: false }
  ]

  test('filters by case-insensitive q across title and repo, exact repo, and sorts descending', () => {
    const byQuery = filterArchiveSessions(sample, { q: 'api' })
    expect(byQuery.sessions.map((session) => session.id)).toEqual(['s2', 's3'])
    expect(byQuery.total).toBe(2)
    expect(byQuery.truncated).toBe(false)

    const byRepo = filterArchiveSessions(sample, { repo: 'api' })
    expect(byRepo.sessions.map((session) => session.id)).toEqual(['s2'])

    const limited = filterArchiveSessions(sample, { limit: 2 })
    expect(limited.sessions.map((session) => session.id)).toEqual(['s2', 's3'])
    expect(limited.total).toBe(3)
    expect(limited.truncated).toBe(true)
  })
})

describe('createMetadataLru and createArchiveScanner', () => {
  test('evicts least-recently-used entries past 200 items and promotes accessed keys', () => {
    const lru = createMetadataLru(MAX_LRU_ENTRIES)
    for (let index = 0; index < MAX_LRU_ENTRIES; index += 1) {
      lru.set(`k-${index}`, { title: `T-${index}`, repo: 'app' })
    }
    expect(lru.get('k-0')?.title).toBe('T-0')
    lru.set('k-200', { title: 'T-200', repo: 'app' })
    expect(lru.size()).toBe(MAX_LRU_ENTRIES)
    expect(lru.get('k-0')?.title).toBe('T-0')
    expect(lru.get('k-1')).toBeUndefined()
  })

  test('scans transcripts on demand, marks active IDs, reads detail, and caps LRU at 200', async () => {
    const now = Date.now()
    writeTranscript('proj-a', 's-old', 'Older task', '/work/web-app', 'First old prompt', now - 10_000)
    writeTranscript('proj-b', 's-new', 'Newer API fix', '/work/api', 'First new prompt', now - 1_000)

    const scanner = createArchiveScanner({ projectsDir })
    const result = await scanner.list({}, new Set(['s-new']))
    expect(result.total).toBe(2)
    expect(result.truncated).toBe(false)
    expect(result.sessions.map((session) => ({ id: session.id, title: session.title, repo: session.repo, active: session.active }))).toEqual([
      { id: 's-new', title: 'Newer API fix', repo: 'api', active: true },
      { id: 's-old', title: 'Older task', repo: 'web-app', active: false }
    ])

    const detail = await scanner.readSession('s-new')
    expect(detail?.id).toBe('s-new')
    expect(detail?.screen).toBeNull()
    expect(detail?.entries[0]?.role).toBe('user')
    expect(detail?.entries[0]?.text).toBe('First new prompt')
    expect(await scanner.readSession('../s-new')).toBeNull()
    expect(await scanner.readSession('missing')).toBeNull()

    for (let index = 0; index < 205; index += 1) {
      writeTranscript('bulk', `bulk-${index}`, `Bulk item ${index}`, '/work/bulk', `Prompt ${index}`)
    }
    const bulkSearch = await scanner.list({ q: 'bulk', limit: 10 }, new Set())
    expect(bulkSearch.sessions).toHaveLength(10)
    expect(bulkSearch.total).toBe(205)
    expect(bulkSearch.truncated).toBe(true)
    expect(scanner.cacheSize()).toBe(MAX_LRU_ENTRIES)
  })
})
