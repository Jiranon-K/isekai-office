import type {
  AgentState,
  CommandRequest,
  CommandResult,
  OfficeAgent,
  OrcaRepo,
  SessionDetail,
  SessionEntry,
  SpawnRequest,
  SpawnResult
} from '@shared/types'
import { mergeToolRuns, sessionHistory } from './history'
import { runJson } from '../run'
import type { SessionSource } from './source'
import { sessionContext } from './transcripts'

const ORCA = process.env.ORCA_BIN ?? '/Applications/Orca.app/Contents/Resources/bin/orca'
const ESCAPE = '\x1b'
const ALLOW_KEY = '1'
const SCREEN_LINES = 24
const READ_LIMIT = 100
const SPAWN_TIMEOUT_MS = 120_000

type RawAgent = {
  orcaSessionId: string
  kind: string
  agent: string
  state: string
  repo?: string
  workspace?: string
  paneKey?: string
  worktreeId?: string
  title?: string
  lastAssistantMessage?: string | null
  updatedAt?: number
}

type RawTerminal = { handle: string; tabId: string; leafId: string; writable: boolean }

type RawEntry = { role?: string; text?: string; tools?: { name: string }[] }

type Envelope<T> = { ok: boolean; result?: T; error?: { message?: string } }

const STATES: AgentState[] = ['working', 'waiting', 'blocked', 'done']

function orca<T>(args: string[], timeout?: number): Promise<T> {
  return runJson<Envelope<T>>([ORCA, ...args, '--json'], timeout).then((envelope) => {
    if (!envelope.ok || !envelope.result) {
      throw new Error(envelope.error?.message ?? `orca ${args[0]} failed`)
    }
    return envelope.result
  })
}

export function toState(state: string): AgentState {
  return STATES.find((known) => known === state) ?? 'done'
}

export function cleanTitle(title: string | undefined, fallback: string): string {
  const text = (title ?? '')
    .replace(/<([\w-]+)>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[\w-]+>[\s\S]*$/, ' ')
    .replace(/<[^>]*>?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text || fallback
}

export function worktreeFromId(worktreeId: string | undefined): string | null {
  const separator = worktreeId?.indexOf('::') ?? -1
  if (!worktreeId || separator === -1) {
    return null
  }
  return worktreeId.slice(separator + 2) || null
}

export function lastTool(entries: RawEntry[]): string | null {
  const tools = entries.flatMap((entry) => entry.tools ?? [])
  return tools.at(-1)?.name ?? null
}

export async function orcaBinaryExists(): Promise<boolean> {
  return Bun.file(ORCA).exists()
}

export async function orcaRunning(): Promise<boolean> {
  try {
    const status = await orca<{ app: { running: boolean }; runtime: { reachable: boolean } }>(['status'])
    return status.app.running && status.runtime.reachable
  } catch {
    return false
  }
}

async function terminalsByPane(): Promise<Map<string, string>> {
  const result = await orca<{ terminals: RawTerminal[] }>(['terminal', 'list'])
  const panes = new Map<string, string>()
  for (const terminal of result.terminals) {
    if (terminal.writable) {
      panes.set(`${terminal.tabId}:${terminal.leafId}`, terminal.handle)
    }
  }
  return panes
}

async function currentTool(id: string): Promise<string | null> {
  try {
    const result = await orca<{ entries: RawEntry[] }>(['agent', 'read', id, '--limit', '2'])
    return lastTool(result.entries)
  } catch {
    return null
  }
}

export async function listAgents(): Promise<OfficeAgent[]> {
  const [{ agents }, panes] = await Promise.all([
    orca<{ agents: RawAgent[] }>(['agent', 'list']),
    terminalsByPane()
  ])
  const claude = agents.filter((agent) => agent.agent === 'claude')
  return Promise.all(
    claude.map(async (agent) => {
      const state = toState(agent.state)
      const title = cleanTitle(agent.title, agent.workspace ?? agent.repo ?? 'Claude')
      const worktree = worktreeFromId(agent.worktreeId)
      const context = worktree ? await sessionContext(worktree, title) : null
      return {
        id: agent.orcaSessionId,
        title,
        repo: agent.repo ?? null,
        workspace: agent.workspace ?? null,
        worktree,
        session: context?.session ?? null,
        contextTokens: context?.contextTokens ?? null,
        state,
        tool: state === 'working' ? await currentTool(agent.orcaSessionId) : null,
        lastMessage: agent.lastAssistantMessage ?? null,
        updatedAt: agent.updatedAt ?? 0,
        activeAt: Math.max(agent.updatedAt ?? 0, context?.modifiedAt ?? 0),
        terminal: agent.kind === 'terminal' && agent.paneKey ? (panes.get(agent.paneKey) ?? null) : null
      }
    })
  )
}

async function orcaEntries(id: string): Promise<SessionEntry[]> {
  const transcript = await orca<{ entries: RawEntry[] }>(['agent', 'read', id, '--limit', String(READ_LIMIT)])
  return mergeToolRuns(
    transcript.entries.map((entry) => ({
      role: entry.role ?? 'assistant',
      text: entry.text ?? '',
      tools: (entry.tools ?? []).map((tool) => tool.name),
      at: null
    }))
  )
}

async function readScreen(terminal: string): Promise<string | null> {
  return orca<{ terminal: { tail?: string[] } }>(['terminal', 'read', '--terminal', terminal, '--screen'])
    .then((result) => result.terminal.tail?.slice(-SCREEN_LINES).join('\n') ?? null)
    .catch(() => null)
}

async function historyFor(agent: OfficeAgent | null): Promise<SessionEntry[] | null> {
  if (!agent?.worktree || !agent.session) {
    return null
  }
  return sessionHistory(agent.worktree, agent.session)
}

export async function readSession(id: string, agent: OfficeAgent | null): Promise<SessionDetail> {
  const entries = (await historyFor(agent)) ?? (await orcaEntries(id))
  const screen = agent?.terminal ? await readScreen(agent.terminal) : null
  return { id, entries, screen }
}

export function sendArgs(terminal: string, request: CommandRequest): string[] | null {
  const base = ['terminal', 'send', '--terminal', terminal]
  switch (request.action) {
    case 'prompt': {
      const text = request.text?.trim()
      return text ? [...base, '--text', text, '--enter', '--wait-submit', '5'] : null
    }
    case 'escape':
      return [...base, '--text', ESCAPE]
    case 'allow':
      return [...base, '--text', ALLOW_KEY]
    case 'deny':
      return [...base, '--text', ESCAPE]
    case 'choose':
      return request.choice === undefined ? null : [...base, '--text', String(request.choice)]
  }
}

export async function sendCommand(terminal: string, request: CommandRequest): Promise<CommandResult> {
  const args = sendArgs(terminal, request)
  if (!args) {
    return { ok: false, error: 'empty_prompt' }
  }
  try {
    await orca(args)
    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function listRepos(): Promise<OrcaRepo[]> {
  const result = await orca<{ repos: { id: string; displayName: string }[] }>(['repo', 'list'])
  return result.repos.map((repo) => ({ id: repo.id, name: repo.displayName }))
}

export function spawnArgs(request: SpawnRequest): string[] {
  return [
    'worktree', 'create',
    '--repo', `id:${request.repoId}`,
    '--name', request.name,
    '--agent', 'claude',
    '--surface', 'terminal',
    ...(request.baseBranch ? ['--base-branch', request.baseBranch] : []),
    ...(request.prompt ? ['--prompt', request.prompt] : [])
  ]
}

export async function createWorktree(request: SpawnRequest): Promise<SpawnResult> {
  try {
    await orca(spawnArgs(request), SPAWN_TIMEOUT_MS)
    return { ok: true, error: null }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export const orcaSource: SessionSource = {
  id: 'orca',
  caps: { command: true, spawn: true, screen: true },
  ready: orcaRunning,
  listAgents,
  readSession
}
