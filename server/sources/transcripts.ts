import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')
const TAIL_BYTES = 256 * 1024
const RECENT_MS = 24 * 60 * 60 * 1000
const TRANSCRIPT_SUFFIX = '.jsonl'

export type TranscriptFacts = { title: string | null; contextTokens: number | null }

export type TranscriptCandidate = { path: string; title: string | null; modifiedAt: number }

type CacheEntry = { key: string; facts: TranscriptFacts }

const cache = new Map<string, CacheEntry>()

export function transcriptFolder(worktree: string, projectsDir = PROJECTS_DIR): string {
  return join(projectsDir, worktree.replace(/[/.]/g, '-'))
}

function usageTokens(usage: Record<string, unknown>): number {
  const fields = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']
  return fields.reduce((sum, field) => sum + (typeof usage[field] === 'number' ? (usage[field] as number) : 0), 0)
}

function parseLine(line: string): Record<string, any> | null {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

export function parseTranscriptTail(text: string): TranscriptFacts {
  const facts: TranscriptFacts = { title: null, contextTokens: null }
  const lines = text.split('\n')
  for (const line of lines.reverse()) {
    if (facts.title !== null && facts.contextTokens !== null) {
      break
    }
    if (facts.title === null && line.includes('"ai-title"')) {
      const parsed = parseLine(line)
      if (parsed?.type === 'ai-title' && typeof parsed.aiTitle === 'string') {
        facts.title = parsed.aiTitle
      }
      continue
    }
    if (facts.contextTokens === null && line.includes('"usage"')) {
      const parsed = parseLine(line)
      if (parsed?.type === 'assistant' && parsed.message?.usage) {
        facts.contextTokens = usageTokens(parsed.message.usage)
      }
    }
  }
  return facts
}

export async function readTail(path: string, size: number, bytes = TAIL_BYTES): Promise<string> {
  if (size <= bytes) {
    return Bun.file(path).text()
  }
  const text = await Bun.file(path).slice(size - bytes, size).text()
  const firstBreak = text.indexOf('\n')
  return firstBreak === -1 ? '' : text.slice(firstBreak + 1)
}

async function factsFor(path: string, modifiedMs: number, size: number): Promise<TranscriptFacts> {
  const key = `${modifiedMs}:${size}`
  const cached = cache.get(path)
  if (cached?.key === key) {
    return cached.facts
  }
  const facts = parseTranscriptTail(await readTail(path, size))
  cache.set(path, { key, facts })
  return facts
}

export function pickTranscript(candidates: TranscriptCandidate[], agentTitle: string, now: number): string | null {
  const recent = candidates.filter((candidate) => now - candidate.modifiedAt <= RECENT_MS)
  const matching = recent
    .filter((candidate) => candidate.title !== null && candidate.title === agentTitle)
    .sort((first, second) => second.modifiedAt - first.modifiedAt)
  const [best] = matching
  if (best) {
    return best.path
  }
  const [only] = recent
  return recent.length === 1 && only ? only.path : null
}

function sessionName(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1)
  return base.slice(0, -TRANSCRIPT_SUFFIX.length)
}

async function listCandidates(folder: string, now: number): Promise<(TranscriptCandidate & TranscriptFacts)[]> {
  const names = await readdir(folder).catch(() => [])
  const found = await Promise.all(
    names
      .filter((name) => name.endsWith(TRANSCRIPT_SUFFIX))
      .map(async (name) => {
        const path = join(folder, name)
        try {
          const info = await stat(path)
          if (now - info.mtimeMs > RECENT_MS) {
            return null
          }
          const facts = await factsFor(path, info.mtimeMs, info.size)
          return { path, modifiedAt: info.mtimeMs, ...facts }
        } catch {
          return null
        }
      })
  )
  return found.filter((candidate) => candidate !== null)
}

export async function sessionContext(
  worktree: string,
  agentTitle: string,
  projectsDir = PROJECTS_DIR
): Promise<{ session: string; contextTokens: number | null; modifiedAt: number | null } | null> {
  const now = Date.now()
  const candidates = await listCandidates(transcriptFolder(worktree, projectsDir), now)
  const picked = pickTranscript(candidates, agentTitle, now)
  if (!picked) {
    return null
  }
  const chosen = candidates.find((candidate) => candidate.path === picked)
  return { session: sessionName(picked), contextTokens: chosen?.contextTokens ?? null, modifiedAt: chosen?.modifiedAt ?? null }
}
