import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ConflictSnapshot } from '@shared/conflicts'
import type { OfficeAgent } from '@shared/types'
import { readTail, transcriptFolder } from '../sources/transcripts'
import { demoConflicts } from './demo-conflicts'
import { detectConflicts, type AgentTouched } from './detect'
import { extractTouchedPaths } from './touched'

const DEFAULT_PROJECTS_DIR = join(homedir(), '.claude', 'projects')
const TRANSCRIPT_SUFFIX = '.jsonl'

type CachedSession = {
  session: string
  filePath: string
  worktree: string | null
  stamp: string
  paths: string[]
}

export type ConflictTrackerOptions = {
  projectsDir?: string
  now?: () => number
}

export type ConflictRouteContext = {
  demo: boolean
  agents(): OfficeAgent[]
  conflictsFor?: (agents: OfficeAgent[]) => Promise<ConflictSnapshot>
  now?: () => number
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function statOrNull(filePath: string): Promise<{ mtimeMs: number; size: number } | null> {
  try {
    const info = await stat(filePath)
    return { mtimeMs: info.mtimeMs, size: info.size }
  } catch {
    return null
  }
}

async function findTranscriptBySession(sessionId: string, projectsDir: string): Promise<string | null> {
  const folders = await readdir(projectsDir, { withFileTypes: true }).catch(() => [])
  const fileName = `${sessionId}${TRANSCRIPT_SUFFIX}`
  for (const folder of folders) {
    if (!folder.isDirectory()) {
      continue
    }
    const candidate = join(projectsDir, folder.name, fileName)
    if (await statOrNull(candidate)) {
      return candidate
    }
  }
  return null
}

async function resolveTranscriptPath(agent: OfficeAgent, cachedPath: string | null, projectsDir: string): Promise<string | null> {
  if (!agent.session) {
    return null
  }
  if (cachedPath && (await statOrNull(cachedPath))) {
    return cachedPath
  }
  if (agent.worktree) {
    const direct = join(transcriptFolder(agent.worktree, projectsDir), `${agent.session}${TRANSCRIPT_SUFFIX}`)
    if (await statOrNull(direct)) {
      return direct
    }
  }
  return findTranscriptBySession(agent.session, projectsDir)
}

export function createConflictTracker(options: ConflictTrackerOptions = {}): {
  conflictsFor(agents: OfficeAgent[]): Promise<ConflictSnapshot>
  cacheSize(): number
} {
  const projectsDir = options.projectsDir ?? DEFAULT_PROJECTS_DIR
  const now = options.now ?? Date.now
  const cache = new Map<string, CachedSession>()

  function pruneCache(activeIds: Set<string>): void {
    for (const agentId of cache.keys()) {
      if (!activeIds.has(agentId)) {
        cache.delete(agentId)
      }
    }
  }

  async function touchedForAgent(agent: OfficeAgent): Promise<AgentTouched> {
    if (!agent.session) {
      cache.delete(agent.id)
      return { agentId: agent.id, repo: agent.repo, worktree: agent.worktree, state: agent.state, updatedAt: agent.updatedAt, paths: [] }
    }
    const existing = cache.get(agent.id)
    const cachedPath = existing?.session === agent.session ? existing.filePath : null
    const filePath = await resolveTranscriptPath(agent, cachedPath, projectsDir)
    if (!filePath) {
      cache.delete(agent.id)
      return { agentId: agent.id, repo: agent.repo, worktree: agent.worktree, state: agent.state, updatedAt: agent.updatedAt, paths: [] }
    }
    const info = await statOrNull(filePath)
    if (!info) {
      cache.delete(agent.id)
      return { agentId: agent.id, repo: agent.repo, worktree: agent.worktree, state: agent.state, updatedAt: agent.updatedAt, paths: [] }
    }
    const stamp = `${info.mtimeMs}:${info.size}`
    if (existing && existing.session === agent.session && existing.filePath === filePath && existing.worktree === agent.worktree && existing.stamp === stamp) {
      return { agentId: agent.id, repo: agent.repo, worktree: agent.worktree, state: agent.state, updatedAt: agent.updatedAt, paths: existing.paths }
    }
    const tail = await readTail(filePath, info.size).catch(() => null)
    if (tail === null) {
      return { agentId: agent.id, repo: agent.repo, worktree: agent.worktree, state: agent.state, updatedAt: agent.updatedAt, paths: [] }
    }
    const paths = extractTouchedPaths(tail.split('\n'), agent.worktree)
    cache.set(agent.id, { session: agent.session, filePath, worktree: agent.worktree, stamp, paths })
    return { agentId: agent.id, repo: agent.repo, worktree: agent.worktree, state: agent.state, updatedAt: agent.updatedAt, paths }
  }

  async function conflictsFor(agents: OfficeAgent[]): Promise<ConflictSnapshot> {
    const active = agents.filter((agent) => agent.state !== 'done')
    pruneCache(new Set(active.map((agent) => agent.id)))
    const touched = await Promise.all(active.map((agent) => touchedForAgent(agent)))
    return { conflicts: detectConflicts(touched), at: now() }
  }

  return {
    conflictsFor,
    cacheSize: () => cache.size
  }
}

const defaultTracker = createConflictTracker()

export async function handleConflicts(request: Request, context: ConflictRouteContext): Promise<Response | null> {
  if (request.method !== 'GET') {
    return null
  }
  const url = new URL(request.url)
  if (url.pathname !== '/api/conflicts') {
    return null
  }
  if (context.demo) {
    return json(demoConflicts((context.now ?? Date.now)()))
  }
  const compute = context.conflictsFor ?? defaultTracker.conflictsFor
  return json(await compute(context.agents()))
}
