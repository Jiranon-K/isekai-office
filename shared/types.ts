export type AgentState = 'working' | 'waiting' | 'blocked' | 'done'

export type OfficeAgent = {
  id: string
  title: string
  repo: string | null
  workspace: string | null
  worktree: string | null
  session: string | null
  contextTokens: number | null
  state: AgentState
  tool: string | null
  lastMessage: string | null
  updatedAt: number
  activeAt: number
  terminal: string | null
}

export type OfficeSnapshot = {
  orcaRunning: boolean
  agents: OfficeAgent[]
  contextWindow: number
  quietAfterMs: number
  error: string | null
  at: number
}

export type LogEvent = {
  at: number
  agentId: string
  title: string
  from: AgentState | null
  to: AgentState | null
}

export type GuildLog = { events: LogEvent[] }

export type BoardColumn = 'todo' | 'doing' | 'review' | 'done'

export type LoopStage = {
  status: string
  mr: string | null
  worktree: string | null
  session: string | null
}

export type MergeState = 'opened' | 'merged' | 'closed'

export type PipelineStatus = 'success' | 'failed' | 'running' | 'pending' | 'canceled' | 'skipped' | 'other'

export type MergeRequestFacts = {
  iid: number
  url: string
  state: MergeState
  pipeline: PipelineStatus | null
  tags: string[]
}

export type SprintState = 'running' | 'planned' | 'closed'

export type Sprint = {
  space: string
  name: string
  state: SprintState
  endDate: string | null
  goal: string | null
}

export type QuestCard = {
  id: string
  key: string | null
  title: string
  space: string
  status: string
  column: BoardColumn
  priority: string | null
  assignee: string | null
  sprint: string | null
  epic: string | null
  labels: string[]
  route: string | null
  updatedAt: string
  url: string
  loop: LoopStage | null
  mergeRequest: MergeRequestFacts | null
}

export type BoardSnapshot = {
  cards: QuestCard[]
  sprints: Sprint[]
  error: string | null
  at: number
}

export type SessionEntry = { role: string; text: string; tools: string[]; at: number | null }

export type SessionDetail = {
  id: string
  entries: SessionEntry[]
  screen: string | null
}

export type Choice = { number: number; label: string; selected: boolean }

export type CommandAction = 'prompt' | 'escape' | 'allow' | 'deny' | 'choose'

export type CommandRequest = {
  agentId: string
  action: CommandAction
  text?: string
  choice?: number
}

export type CommandResult = {
  ok: boolean
  error: string | null
}
