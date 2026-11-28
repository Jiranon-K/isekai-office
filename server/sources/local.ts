import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { OfficeAgent, SessionDetail, SourceAgent } from '@shared/types'
import { createManagedRunner, isLocalInteractiveEnabled, type ManagedRunner } from '../managed/runner'
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

async function isUnchanged(file: RecentFile): Promise<boolean> {
  const info = await stat(file.path).catch(() => null)
  return info !== null && info.size === file.size && info.mtimeMs === file.modifiedAt
}

type LocalOptions = Omit<RecentFilesOptions, 'refreshMs'> & {
  refreshMs?: number
  hints?: HintStore
  managed?: ManagedRunner | null
}

function mergeManagedAndExternal(managedAgents: SourceAgent[], externalAgents: SourceAgent[]): SourceAgent[] {
  if (managedAgents.length === 0) {
    return externalAgents
  }
  const managedSessionIds = new Set<string>()
  for (const agent of managedAgents) {
    managedSessionIds.add(agent.id)
    if (agent.session) {
      managedSessionIds.add(agent.session)
    }
  }
  const externalOnly = externalAgents.filter((agent) => !managedSessionIds.has(agent.id) && (!agent.session || !managedSessionIds.has(agent.session)))
  return [...managedAgents, ...externalOnly]
}

export function createLocalSource(options: LocalOptions): SessionSource {
  const hints = options.hints ?? hintStore
  const managed = options.managed ?? null
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
    if (await isUnchanged(file)) {
      cache.set(file.path, analysed)
    }
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

  async function toAgent(file: RecentFile): Promise<SourceAgent> {
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

  async function listAgents(): Promise<SourceAgent[]> {
    const files = await recent.list()
    forget(files)
    hints.prune((options.now ?? Date.now)() - options.recentMs)
    const agents = await Promise.all(files.map((file) => toAgent(file).catch(() => null)))
    const external = agents.filter((agent) => agent !== null)
    return managed ? mergeManagedAndExternal(managed.listAgents(), external) : external
  }

  async function readSession(id: string): Promise<SessionDetail> {
    const managedSession = managed?.readSession(id) ?? null
    if (managedSession) {
      return managedSession
    }
    const file = (await recent.list()).find((candidate) => candidate.id === id)
    const entries = file ? ((await historyAt(file.path)) ?? []) : []
    return { id, entries, screen: null }
  }

  const interactive = managed !== null
  return {
    id: 'local',
    caps: interactive ? { command: true, spawn: true, screen: true } : { command: false, spawn: false, screen: false },
    ready: async () => true,
    listAgents,
    readSession,
    ...(managed ? { managedStats: () => ({ count: managed.activeCount(), cap: managed.maxSessions() }) } : {})
  }
}

const localRecentMs = recentMsFrom(process.env.LOCAL_RECENT_MINUTES)

export const localInteractiveEnabled = isLocalInteractiveEnabled(process.env.LOCAL_INTERACTIVE, Bun.which('claude') !== null)

export const localManagedRunner: ManagedRunner | null = localInteractiveEnabled
  ? createManagedRunner({ recentMs: localRecentMs })
  : null

export const localSource = createLocalSource({
  projectsDir: join(homedir(), '.claude', 'projects'),
  recentMs: localRecentMs,
  managed: localManagedRunner
})
