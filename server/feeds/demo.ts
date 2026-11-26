import type {
  AgentState,
  BoardSnapshot,
  CommandResult,
  LoopStage,
  MergeRequestFacts,
  OfficeAgent,
  OfficeSnapshot,
  QuestCard,
  SessionDetail,
  SessionEntry
} from '@shared/types'

const MINUTE = 60_000
const TASK_URL = 'https://workspace.example.com/tasks/'
const MR_URL = 'https://git.example.com/acme/web-app/-/merge_requests/'

type AgentSeed = [id: string, title: string, repo: string, state: AgentState, tool: string | null, tokens: number, last: string | null]

const AGENT_SEEDS: AgentSeed[] = [
  ['a1', 'APP-12 dark mode toggle', 'web-app', 'working', 'Edit', 182_000, null],
  ['a2', 'APP-14 flaky checkout test', 'web-app', 'working', 'Read', 96_000, null],
  ['a3', 'OPS-7 slow orders query', 'api', 'working', 'Bash', 412_000, null],
  ['a4', 'Research rate limit options', 'api', 'working', 'WebSearch', 64_000, null],
  ['a5', 'APP-18 onboarding checklist', 'web-app', 'waiting', 'Bash', 238_000, 'Allow Bash: bun run db:migrate?'],
  ['a6', 'OPS-9 rotate signing keys', 'infra', 'blocked', null, 705_000, 'I need the staging vault path before I can continue.'],
  ['a7', 'APP-9 empty states', 'web-app', 'done', null, 452_000, 'Opened the merge request and all checks pass.'],
  ['a8', 'Write API changelog', 'docs', 'done', null, 48_000, 'Changelog drafted for 2.4.0.']
]

const QUIET_DEMO_MINUTES: Record<string, number> = { a4: 14 }

function agentFrom([id, title, repo, state, tool, tokens, last]: AgentSeed, now: number): OfficeAgent {
  return {
    id,
    title,
    repo,
    workspace: 'main',
    worktree: null,
    session: null,
    contextTokens: tokens,
    state,
    tool,
    lastMessage: last,
    updatedAt: now - MINUTE,
    activeAt: now - (QUIET_DEMO_MINUTES[id] ?? 1) * MINUTE,
    terminal: id === 'a8' ? null : `demo-${id}`
  }
}

function officeSnapshot(): OfficeSnapshot {
  const now = Date.now()
  return { orcaRunning: true, agents: AGENT_SEEDS.map((seed) => agentFrom(seed, now)), contextWindow: 1_000_000, quietAfterMs: 10 * MINUTE, error: null, at: now }
}

type CardSeed = [key: string, title: string, column: QuestCard['column'], route: string, loop: string | null, extra?: Partial<QuestCard>]

const CARD_SEEDS: CardSeed[] = [
  ['APP-12', 'Dark mode toggle in settings', 'doing', 'agent', 'working', { labels: ['type:feature', 'risk:low'] }],
  ['APP-14', 'Checkout test fails one run in five', 'doing', 'agent', 'working', { labels: ['type:bug'], priority: 'High' }],
  ['APP-18', 'Onboarding checklist for new teams', 'doing', 'agent', 'working', { labels: ['type:feature'] }],
  ['APP-21', 'Search inside project settings', 'todo', 'agent', 'design_ready', { labels: ['type:feature', 'risk:medium'] }],
  ['APP-9', 'Empty states for lists', 'review', 'agent', 'mr_open', { labels: ['type:feature'] }],
  ['APP-6', 'Keyboard shortcuts overlay', 'done', 'agent', 'merged', { labels: ['type:feature'] }],
  ['APP-23', 'Decide the pricing page copy', 'doing', 'human', null],
  ['APP-25', 'Export a report as CSV', 'todo', 'agent', null, { labels: ['type:feature'] }],
  ['OPS-7', 'Orders query takes four seconds', 'doing', 'agent', 'working', { labels: ['type:bug'], priority: 'Urgent' }],
  ['OPS-9', 'Rotate the signing keys', 'doing', 'agent', 'blocked', { labels: ['type:chore', 'risk:high'] }],
  ['OPS-11', 'Alert when the queue backs up', 'review', 'agent', 'mr_open', { labels: ['type:feature'] }],
  ['OPS-4', 'Nightly backup check', 'done', 'agent', 'merged', { labels: ['type:chore'] }]
]

const MERGE_FACTS: Record<string, Omit<MergeRequestFacts, 'url'>> = {
  'APP-9': { iid: 128, state: 'opened', pipeline: 'success', tags: [] },
  'APP-6': { iid: 121, state: 'merged', pipeline: 'success', tags: ['v2.4.0-rc.1'] },
  'OPS-11': { iid: 64, state: 'opened', pipeline: 'running', tags: [] },
  'OPS-4': { iid: 60, state: 'merged', pipeline: 'success', tags: ['v1.9.0'] }
}

function loopFor(status: string | null, mr: string | null): LoopStage | null {
  return status ? { status, mr, worktree: null, session: null } : null
}

function cardFrom([key, title, column, route, loop, extra]: CardSeed, index: number, now: number): QuestCard {
  const space = key.slice(0, key.indexOf('-'))
  const facts = MERGE_FACTS[key]
  const url = facts ? `${MR_URL}${facts.iid}` : null
  return {
    id: key,
    key,
    title,
    space,
    status: column,
    column,
    priority: null,
    assignee: 'You',
    sprint: space === 'APP' ? '2.4.0' : '1.9.0',
    epic: null,
    labels: [],
    route,
    updatedAt: new Date(now - index * 37 * MINUTE).toISOString(),
    url: `${TASK_URL}${key}`,
    loop: loopFor(loop, url),
    mergeRequest: facts && url ? { ...facts, url } : null,
    ...extra
  }
}

function boardSnapshot(): BoardSnapshot {
  const now = Date.now()
  return {
    cards: CARD_SEEDS.map((seed, index) => cardFrom(seed, index, now)),
    sprints: [
      { space: 'APP', name: '2.4.0', state: 'running', endDate: null, goal: 'Onboarding and polish' },
      { space: 'OPS', name: '1.9.0', state: 'running', endDate: null, goal: 'Faster orders' }
    ],
    error: null,
    at: now
  }
}

const SCREEN = [
  '⏺ Bash(bun run db:migrate)',
  '',
  ' Do you want to proceed?',
  ' ❯ 1. Yes',
  '   2. Yes, and do not ask again for bun run commands',
  '   3. No, and tell Claude what to do differently (esc)'
].join('\n')

const QUESTION_SCREEN = [
  ' Which store should hold the vault paths?',
  '',
  ' ❯ 1. Environment variables',
  '      Simple, read at start up',
  '   2. Vault agent sidecar',
  '      Rotates without a restart',
  '   3. Config file in the repo',
  '      Easy to review',
  '   4. Other',
  '      Say it in the full panel'
].join('\n')

function screenFor(id: string): string {
  return id === 'a6' ? QUESTION_SCREEN : SCREEN
}

function chat(now: number): SessionEntry[] {
  const at = (minutesAgo: number): number => now - minutesAgo * MINUTE
  return [
    { role: 'user', text: 'Add the onboarding checklist from the spec. Keep it behind the new-team flag.', tools: [], at: at(42) },
    { role: 'assistant', text: 'I will read the spec and the settings page first, then add the checklist component.', tools: [], at: at(42) },
    { role: 'assistant', text: '', tools: ['Read', 'Read', 'Grep', 'Read'], at: at(40) },
    { role: 'assistant', text: 'The checklist needs one new table for progress. I wrote the migration and the component with tests.', tools: [], at: at(31) },
    { role: 'assistant', text: '', tools: ['Write', 'Write', 'Edit', 'Bash', 'Bash'], at: at(24) },
    { role: 'user', text: 'Looks good. Run the migration on the dev database.', tools: [], at: at(3) },
    { role: 'assistant', text: 'Running the migration now.', tools: ['Bash'], at: at(2) }
  ]
}

export function demoSubscribe(listener: (snapshot: OfficeSnapshot) => void): () => void {
  listener(officeSnapshot())
  return () => {}
}

export function demoSnapshot(): OfficeSnapshot {
  return officeSnapshot()
}

export async function demoBoard(): Promise<BoardSnapshot> {
  return boardSnapshot()
}

export async function demoSession(id: string, agent: OfficeAgent | null): Promise<SessionDetail> {
  return { id, entries: chat(Date.now()), screen: agent?.terminal ? screenFor(id) : null }
}

export async function demoCommand(): Promise<CommandResult> {
  return { ok: true, error: null }
}
