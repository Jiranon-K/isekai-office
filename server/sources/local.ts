import { homedir } from 'node:os'
import { join } from 'node:path'
import type { OfficeAgent, SessionDetail } from '@shared/types'
import { historyAt } from './history'
import { baseNameOf, localFacts, titleFrom, type LocalFacts } from './local-facts'
import { createRecentFiles, type RecentFile, type RecentFilesOptions } from './recent-files'
import { applyHint, hintStore, type HintStore } from './hints'
import { stateFromTail, toolFromTail } from './session-state'
import type { SessionSource } from './source'
import { readTail } from './transcripts'

const DEFAULT_RECENT_MINUTES = 60
const REFRESH_MS = 30_000
const MINUTE_MS = 60_000
const FALLBACK_TITLE = 'Claude'

type Snapshotted = { key: string; facts: LocalFacts; state: OfficeAgent['state']; tool: string | null }

export function recentMsFrom(value: string | undefined): number {
  const parsed = Number(value)
  const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RECENT_MINUTES
  return Math.floor(minutes * MINUTE_MS)
}

async function readLines(file: RecentFile): Promise<string[]> {
  return (await readTail(file.path, file.size)).split('\n')
}

type LocalOptions = Omit<RecentFilesOptions, 'refreshMs'> & { refreshMs?: number; hints?: HintStore }

export function createLocalSource(options: LocalOptions): SessionSource {
  const hints = options.hints ?? hintStore
  const recent = createRecentFiles({ refreshMs: REFRESH_MS, ...options })
  const cache = new Map<string, Snapshotted>()
  const titles = new Map<string, string>()

  async function analyse(file: RecentFile): Promise<Snapshotted> {
    const key = `${file.modifiedAt}:${file.size}`
    const cached = cache.get(file.path)
    if (cached?.key === key) {
      return cached
    }
    const lines = await readLines(file)
    const state = stateFromTail(lines)
    const foundTitle = titleFrom(lines)
    if (foundTitle) {
      titles.set(file.path, foundTitle)
    }
    const analysed = { key, facts: localFacts(lines, titles.get(file.path) ?? null), state, tool: state === 'working' ? toolFromTail(lines) : null }
    cache.set(file.path, analysed)
    return analysed
  }

  function forget(files: RecentFile[]): void {
    const live = new Set(files.map((file) => file.path))
    for (const path of cache.keys()) {
      if (!live.has(path)) {
        cache.delete(path)
        titles.delete(path)
      }
    }
  }

  async function toAgent(file: RecentFile): Promise<OfficeAgent> {
    const { facts, state: tailState, tool } = await analyse(file)
    const state = applyHint(tailState, hints.get(file.id), file.modifiedAt)
    const repo = facts.cwd ? baseNameOf(facts.cwd) : null
    return {
      id: file.id,
      title: facts.title ?? FALLBACK_TITLE,
      repo,
      workspace: null,
      worktree: facts.cwd,
      session: file.id,
      contextTokens: facts.contextTokens,
      state,
      tool: state === 'done' ? null : tool,
      lastMessage: null,
      updatedAt: file.modifiedAt,
      activeAt: file.modifiedAt,
      terminal: null
    }
  }

  async function listAgents(): Promise<OfficeAgent[]> {
    const files = await recent.list()
    forget(files)
    hints.prune((options.now ?? Date.now)() - options.recentMs)
    return Promise.all(files.map(toAgent))
  }

  async function readSession(id: string): Promise<SessionDetail> {
    const file = (await recent.list()).find((candidate) => candidate.id === id)
    const entries = file ? ((await historyAt(file.path)) ?? []) : []
    return { id, entries, screen: null }
  }

  return {
    id: 'local',
    caps: { command: false, spawn: false, screen: false },
    ready: async () => true,
    listAgents,
    readSession
  }
}

export const localSource = createLocalSource({
  projectsDir: join(homedir(), '.claude', 'projects'),
  recentMs: recentMsFrom(process.env.LOCAL_RECENT_MINUTES)
})
