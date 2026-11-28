import type {
  CommandRequest,
  CommandResult,
  OfficeAgent,
  OrcaRepo,
  SessionDetail,
  SpawnRequest,
  SpawnResult
} from '@shared/types'
import {
  claudeStreamArgs,
  encodeControlResponse,
  encodeInterrupt,
  encodeUserPrompt,
  parseStreamLine
} from './protocol'
import { listLocalRepos } from './repos'
import {
  appendScreenLines,
  appendSessionEntry,
  applyStreamEvent,
  consumeStreamLines,
  MANAGED_TERMINAL_PREFIX,
  managedIdFromTerminal,
  sessionToAgent,
  sessionToDetail,
  type ManagedProcess,
  type ManagedSession
} from './session'

export { appendScreenLines, MANAGED_TERMINAL_PREFIX, managedIdFromTerminal, type ManagedProcess }

export const DEFAULT_MAX_MANAGED_SESSIONS = 4

const MIN_MANAGED_SESSIONS = 1
const MAX_MANAGED_SESSIONS_LIMIT = 8
const DEFAULT_RECENT_MS = 60 * 60_000

export type ManagedProcessSpawner = (command: string[], cwd: string) => ManagedProcess

export type ManagedRunnerOptions = {
  maxSessions?: number
  recentMs?: number
  claudeBin?: string
  allowedRepos?: () => Promise<OrcaRepo[]>
  spawnProcess?: ManagedProcessSpawner
  now?: () => number
  createUuid?: () => string
  onChange?: () => void
}

export type ManagedRunner = {
  spawn(request: SpawnRequest): Promise<SpawnResult>
  sendCommand(managedId: string, command: CommandRequest): Promise<CommandResult>
  listAgents(): OfficeAgent[]
  readSession(id: string): SessionDetail | null
  activeCount(): number
  maxSessions(): number
  dispose(): void
}

export function maxManagedSessionsFrom(raw: string | undefined): number {
  if (!raw) {
    return DEFAULT_MAX_MANAGED_SESSIONS
  }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_MANAGED_SESSIONS
  }
  return Math.min(MAX_MANAGED_SESSIONS_LIMIT, Math.max(MIN_MANAGED_SESSIONS, Math.floor(parsed)))
}

export function isLocalInteractiveEnabled(envValue: string | undefined, claudeAvailable: boolean): boolean {
  return envValue !== '0' && claudeAvailable
}

function spawnBunProcess(command: string[], cwd: string): ManagedProcess {
  const child = Bun.spawn(command, { cwd, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  return {
    write(chunk: string): boolean {
      try {
        child.stdin.write(chunk)
        void child.stdin.flush()
        return true
      } catch {
        return false
      }
    },
    kill(): void {
      try {
        child.kill()
      } catch {
        return
      }
    },
    stdout: child.stdout,
    stderr: child.stderr,
    exited: child.exited
  }
}

export function createManagedRunner(options: ManagedRunnerOptions = {}): ManagedRunner {
  const cap = options.maxSessions ?? maxManagedSessionsFrom(process.env.MAX_MANAGED_SESSIONS)
  const recentMs = options.recentMs ?? DEFAULT_RECENT_MS
  const claudeBin = options.claudeBin ?? 'claude'
  const allowedRepos = options.allowedRepos ?? (() => listLocalRepos())
  const spawnProcess = options.spawnProcess ?? spawnBunProcess
  const now = options.now ?? Date.now
  const createUuid = options.createUuid ?? (() => crypto.randomUUID())
  const sessions = new Map<string, ManagedSession>()

  function notify(): void {
    options.onChange?.()
  }

  function pruneExited(): void {
    const cutoff = now() - recentMs
    for (const [id, session] of sessions) {
      if (session.exitedAt !== null && session.exitedAt < cutoff) {
        sessions.delete(id)
      }
    }
  }

  function activeCount(): number {
    let count = 0
    for (const session of sessions.values()) {
      if (session.process !== null) {
        count += 1
      }
    }
    return count
  }

  function watchProcess(session: ManagedSession, child: ManagedProcess): void {
    void consumeStreamLines(child.stdout, (line) => {
      if (applyStreamEvent(session, parseStreamLine(line), now())) {
        notify()
      }
    })
    void consumeStreamLines(child.stderr, (line) => {
      if (line.trim()) {
        session.screenLines = appendScreenLines(session.screenLines, line)
        session.updatedAt = now()
        notify()
      }
    })
    void child.exited.then((code) => {
      session.process = null
      session.pendingRequestId = null
      session.state = 'done'
      session.tool = null
      session.exitedAt = now()
      session.updatedAt = session.exitedAt
      if (code !== 0) {
        session.screenLines = appendScreenLines(session.screenLines, `Process exited with code ${code}`)
      }
      notify()
    })
  }

  async function spawn(request: SpawnRequest): Promise<SpawnResult> {
    const repos = await allowedRepos()
    pruneExited()
    if (activeCount() >= cap) {
      return { ok: false, error: 'too_many_sessions' }
    }
    const matched = repos.find((repo) => repo.id === request.repoId)
    if (!matched) {
      return { ok: false, error: 'invalid_repo' }
    }
    const sessionId = createUuid()
    const id = `managed-${sessionId.slice(0, 8)}`
    let child: ManagedProcess
    try {
      child = spawnProcess([claudeBin, ...claudeStreamArgs(sessionId)], matched.id)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
    const stamp = now()
    const session: ManagedSession = {
      id,
      sessionId,
      title: request.name,
      repo: matched.name,
      worktree: matched.id,
      state: request.prompt ? 'working' : 'done',
      tool: null,
      lastMessage: null,
      contextTokens: null,
      updatedAt: stamp,
      activeAt: stamp,
      pendingRequestId: null,
      screenLines: [],
      entries: [],
      process: child,
      exitedAt: null
    }
    sessions.set(id, session)
    watchProcess(session, child)
    if (request.prompt) {
      if (!child.write(encodeUserPrompt(request.prompt))) {
        child.kill()
        sessions.delete(id)
        return { ok: false, error: 'write_failed' }
      }
      session.entries = appendSessionEntry(session.entries, { role: 'user', text: request.prompt, tools: [], at: stamp })
    }
    notify()
    return { ok: true, error: null }
  }

  async function sendCommand(managedId: string, command: CommandRequest): Promise<CommandResult> {
    const session = sessions.get(managedId)
    if (!session || !session.process) {
      return { ok: false, error: 'no_terminal' }
    }
    const stamp = now()
    if (command.action === 'prompt') {
      const text = command.text?.trim() ?? ''
      if (!text) {
        return { ok: false, error: 'empty_prompt' }
      }
      if (session.pendingRequestId) {
        return { ok: false, error: 'pending_decision' }
      }
      if (!session.process.write(encodeUserPrompt(text))) {
        return { ok: false, error: 'write_failed' }
      }
      session.entries = appendSessionEntry(session.entries, { role: 'user', text, tools: [], at: stamp })
      session.state = 'working'
      session.updatedAt = stamp
      session.activeAt = stamp
      notify()
      return { ok: true, error: null }
    }
    if (command.action === 'allow' || command.action === 'deny' || command.action === 'choose') {
      if (!session.pendingRequestId) {
        return { ok: false, error: 'no_pending_prompt' }
      }
      const allow = command.action === 'allow' || (command.action === 'choose' && command.choice === 1)
      if (!session.process.write(encodeControlResponse(session.pendingRequestId, allow))) {
        return { ok: false, error: 'write_failed' }
      }
      session.pendingRequestId = null
      session.state = 'working'
      session.updatedAt = stamp
      session.activeAt = stamp
      notify()
      return { ok: true, error: null }
    }
    if (!session.process.write(encodeInterrupt(createUuid()))) {
      session.process.kill()
    }
    session.pendingRequestId = null
    session.state = 'done'
    session.tool = null
    session.updatedAt = stamp
    notify()
    return { ok: true, error: null }
  }

  function listAgents(): OfficeAgent[] {
    pruneExited()
    return [...sessions.values()].map(sessionToAgent)
  }

  function readSession(id: string): SessionDetail | null {
    const match = sessions.get(id) ?? [...sessions.values()].find((session) => session.sessionId === id) ?? null
    return match ? sessionToDetail(match) : null
  }

  function dispose(): void {
    for (const session of sessions.values()) {
      if (session.process) {
        session.process.kill()
        session.process = null
      }
    }
  }

  return {
    spawn,
    sendCommand,
    listAgents,
    readSession,
    activeCount,
    maxSessions: () => cap,
    dispose
  }
}
