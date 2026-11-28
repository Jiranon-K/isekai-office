import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import type { OrcaRepo } from '@shared/types'
import { baseNameOf, localFacts } from '../sources/local-facts'
import { isHomeOrRoot } from '../sources/permissions'
import { readTail } from '../sources/transcripts'

const DEFAULT_PROJECTS_DIR = join(homedir(), '.claude', 'projects')
const DEFAULT_MAX_REPOS = 20
const DEFAULT_SCAN_FILES = 40
const TRANSCRIPT_SUFFIX = '.jsonl'

export type LocalReposOptions = {
  envRepos?: string
  projectsDir?: string
  maxRepos?: number
  home?: string
}

type TranscriptFile = { path: string; modifiedAt: number; size: number }

export function parseEnvRepos(raw: string | undefined): string[] {
  if (!raw) {
    return []
  }
  return raw
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function normalizedKey(folderPath: string): string {
  const full = resolve(folderPath)
  return process.platform === 'win32' ? full.toLowerCase() : full
}

async function isValidRepoDir(folderPath: string, home: string): Promise<string | null> {
  if (!isAbsolute(folderPath) || isHomeOrRoot(folderPath, home)) {
    return null
  }
  const resolved = resolve(folderPath)
  try {
    const info = await stat(resolved)
    return info.isDirectory() ? resolved : null
  } catch {
    return null
  }
}

async function recentTranscriptFiles(projectsDir: string): Promise<TranscriptFile[]> {
  const folders = await readdir(projectsDir, { withFileTypes: true }).catch(() => [])
  const files: TranscriptFile[] = []
  for (const folder of folders) {
    if (!folder.isDirectory()) {
      continue
    }
    const folderPath = join(projectsDir, folder.name)
    const names = await readdir(folderPath).catch(() => [])
    const entries = await Promise.all(
      names
        .filter((name) => name.endsWith(TRANSCRIPT_SUFFIX))
        .map(async (name): Promise<TranscriptFile | null> => {
          const path = join(folderPath, name)
          const info = await stat(path).catch(() => null)
          return info ? { path, modifiedAt: info.mtimeMs, size: info.size } : null
        })
    )
    for (const entry of entries) {
      if (entry) {
        files.push(entry)
      }
    }
  }
  return files.sort((first, second) => second.modifiedAt - first.modifiedAt).slice(0, DEFAULT_SCAN_FILES)
}

async function cwdsFromTranscripts(projectsDir: string): Promise<string[]> {
  const files = await recentTranscriptFiles(projectsDir)
  const found: string[] = []
  for (const file of files) {
    const tail = await readTail(file.path, file.size).catch(() => null)
    if (tail === null) {
      continue
    }
    const { cwd } = localFacts(tail.split('\n'))
    if (cwd) {
      found.push(cwd)
    }
  }
  return found
}

export async function listLocalRepos(options: LocalReposOptions = {}): Promise<OrcaRepo[]> {
  const home = options.home ?? homedir()
  const maxRepos = Math.max(1, options.maxRepos ?? DEFAULT_MAX_REPOS)
  const projectsDir = options.projectsDir ?? DEFAULT_PROJECTS_DIR
  const envCandidates = parseEnvRepos(options.envRepos ?? process.env.LOCAL_REPOS)
  const transcriptCandidates = await cwdsFromTranscripts(projectsDir)
  const repos: OrcaRepo[] = []
  const seen = new Set<string>()
  for (const candidate of [...envCandidates, ...transcriptCandidates]) {
    if (repos.length >= maxRepos) {
      break
    }
    const validPath = await isValidRepoDir(candidate, home)
    if (!validPath) {
      continue
    }
    const key = normalizedKey(validPath)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    repos.push({ id: validPath, name: baseNameOf(validPath) ?? validPath })
  }
  return repos
}
