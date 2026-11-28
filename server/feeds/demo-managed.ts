import type {
  AgentState,
  CommandRequest,
  CommandResult,
  SourceAgent,
  OrcaRepo,
  SessionDetail,
  SessionEntry,
  SpawnRequest,
  SpawnResult
} from '@shared/types'
import { formatPermissionScreen } from '../managed/protocol'
import { DEFAULT_MAX_MANAGED_SESSIONS, MANAGED_TERMINAL_PREFIX, managedIdFromTerminal } from '../managed/runner'

type DemoManagedSession = {
  id: string
  title: string
  repo: string
  state: AgentState
  tool: string | null
  lastMessage: string | null
  updatedAt: number
  activeAt: number
  entries: SessionEntry[]
  screen: string
  active: boolean
}

const DEMO_REPO_NAMES: Record<string, string> = {
  'demo-repo-1': 'tavern-api',
  'demo-repo-2': 'tavern-web'
}

export function createDemoManagedStore(repos: OrcaRepo[] = []): {
  spawn(request?: SpawnRequest): SpawnResult
  command(terminal: string, request?: CommandRequest): CommandResult
  agents(): SourceAgent[]
  readSession(id: string): SessionDetail | null
  count(): number
  cap(): number
  reset(): void
} {
  const sessions = new Map<string, DemoManagedSession>()
  let counter = 0

  function repoName(repoId: string | undefined): string {
    if (!repoId) {
      return 'tavern-web'
    }
    return repos.find((repo) => repo.id === repoId)?.name ?? DEMO_REPO_NAMES[repoId] ?? repoId
  }

  function activeCount(): number {
    let count = 0
    for (const session of sessions.values()) {
      if (session.active) {
        count += 1
      }
    }
    return count
  }

  function spawn(request?: SpawnRequest): SpawnResult {
    if (activeCount() >= DEFAULT_MAX_MANAGED_SESSIONS) {
      return { ok: false, error: 'too_many_sessions' }
    }
    counter += 1
    const id = `managed-demo-${counter}`
    const now = Date.now()
    const entries: SessionEntry[] = []
    if (request?.prompt) {
      entries.push({ role: 'user', text: request.prompt, tools: [], at: now })
    }
    entries.push({
      role: 'assistant',
      text: 'Ready to inspect the repo and run tests. Waiting for permission to run Bash.',
      tools: ['Bash'],
      at: now
    })
    sessions.set(id, {
      id,
      title: request?.name ?? `demo-session-${counter}`,
      repo: repoName(request?.repoId),
      state: 'waiting',
      tool: 'Bash',
      lastMessage: 'Allow Bash: bun test?',
      updatedAt: now,
      activeAt: now,
      entries,
      screen: formatPermissionScreen('Bash', { command: 'bun test' }),
      active: true
    })
    return { ok: true, error: null }
  }

  function command(terminal: string, request?: CommandRequest): CommandResult {
    const id = managedIdFromTerminal(terminal)
    const session = id ? sessions.get(id) : undefined
    if (!session || !session.active) {
      return { ok: false, error: 'no_terminal' }
    }
    const now = Date.now()
    if (!request || request.action === 'allow' || (request.action === 'choose' && request.choice === 1)) {
      session.state = 'working'
      session.tool = 'Bash'
      session.lastMessage = 'Running bun test...'
      session.entries.push({ role: 'assistant', text: 'Permission granted. Running bun test now.', tools: ['Bash'], at: now })
      session.updatedAt = now
      session.activeAt = now
      return { ok: true, error: null }
    }
    if (request.action === 'deny' || request.action === 'choose') {
      session.state = 'done'
      session.tool = null
      session.lastMessage = 'Denied from Isekai Office.'
      session.entries.push({ role: 'assistant', text: 'Action denied from Isekai Office.', tools: [], at: now })
      session.updatedAt = now
      session.activeAt = now
      return { ok: true, error: null }
    }
    if (request.action === 'escape') {
      session.state = 'done'
      session.tool = null
      session.lastMessage = 'Interrupted from Isekai Office.'
      session.entries.push({ role: 'assistant', text: 'Session interrupted.', tools: [], at: now })
      session.updatedAt = now
      session.activeAt = now
      return { ok: true, error: null }
    }
    const text = request.text?.trim() ?? ''
    if (!text) {
      return { ok: false, error: 'empty_prompt' }
    }
    session.entries.push({ role: 'user', text, tools: [], at: now })
    session.entries.push({ role: 'assistant', text: `Working on: ${text}`, tools: [], at: now })
    session.state = 'working'
    session.lastMessage = `Working on: ${text}`
    session.updatedAt = now
    session.activeAt = now
    return { ok: true, error: null }
  }

  function agents(): SourceAgent[] {
    return [...sessions.values()].map((session): SourceAgent => ({
      id: session.id,
      title: session.title,
      repo: session.repo,
      workspace: 'main',
      worktree: null,
      session: session.id,
      contextTokens: 24_000,
      state: session.state,
      tool: session.state === 'done' ? null : session.tool,
      lastMessage: session.lastMessage,
      updatedAt: session.updatedAt,
      activeAt: session.activeAt,
      terminal: session.active ? `${MANAGED_TERMINAL_PREFIX}${session.id}` : null
    }))
  }

  function readSession(id: string): SessionDetail | null {
    const session = sessions.get(id)
    if (!session) {
      return null
    }
    return {
      id: session.id,
      entries: [...session.entries],
      screen: session.active ? session.screen : null
    }
  }

  function reset(): void {
    sessions.clear()
    counter = 0
  }

  return {
    spawn,
    command,
    agents,
    readSession,
    count: activeCount,
    cap: () => DEFAULT_MAX_MANAGED_SESSIONS,
    reset
  }
}
