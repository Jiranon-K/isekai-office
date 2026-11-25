import type { BoardColumn, BoardSnapshot, OfficeAgent, QuestCard, Sprint } from '@shared/types'
import { groupByColumn } from './board-logic'
import { releaseRounds, type ReleaseRound } from './release-logic'

export type WaitReason = 'agent_asks' | 'blocked' | 'design_review' | 'verify_mr' | 'my_task'

export const WAIT_ORDER: WaitReason[] = ['agent_asks', 'blocked', 'design_review', 'verify_mr', 'my_task']

export const WAIT_LABELS: Record<WaitReason, string> = {
  agent_asks: 'session ถามอยู่',
  blocked: 'Loop ติดอยู่',
  design_review: 'รอตรวจ design',
  verify_mr: 'MR รอ verify',
  my_task: 'งานของผม'
}

export type BoardItem = { card: QuestCard; agent: OfficeAgent | null; reason: WaitReason | null }

export type SprintChoice = { kind: 'running' } | { kind: 'all' } | { kind: 'named'; name: string }

export type BoardFilter = { space: string | null; sprint: SprintChoice }

export const DEFAULT_FILTER: BoardFilter = { space: null, sprint: { kind: 'running' } }

export type FilterOptions = { spaces: string[]; sprints: string[] }

export type BoardView = {
  waiting: BoardItem[]
  rounds: ReleaseRound[]
  columns: Record<BoardColumn, BoardItem[]>
}

const NAMED_PREFIX = 'named:'

export function sprintChoiceValue(choice: SprintChoice): string {
  return choice.kind === 'named' ? `${NAMED_PREFIX}${choice.name}` : choice.kind
}

export function sprintChoiceFromValue(value: string): SprintChoice {
  if (value.startsWith(NAMED_PREFIX)) {
    return { kind: 'named', name: value.slice(NAMED_PREFIX.length) }
  }
  return value === 'all' ? { kind: 'all' } : { kind: 'running' }
}

const LOOP_REASONS: Record<string, WaitReason> = {
  blocked: 'blocked',
  design_ready: 'design_review',
  mr_open: 'verify_mr'
}

export function waitReason(card: QuestCard, agent: OfficeAgent | null): WaitReason | null {
  if (card.column === 'done') {
    return null
  }
  if (agent && (agent.state === 'waiting' || agent.state === 'blocked')) {
    return 'agent_asks'
  }
  if (card.loop) {
    return LOOP_REASONS[card.loop.status] ?? null
  }
  const isMine = card.route === 'human' && (card.column === 'doing' || card.column === 'review')
  return isMine ? 'my_task' : null
}

function newest(agents: OfficeAgent[]): OfficeAgent | null {
  return agents.reduce<OfficeAgent | null>((best, agent) => (!best || agent.updatedAt > best.updatedAt ? agent : best), null)
}

function escapeForPattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function mentionsKey(title: string, key: string): boolean {
  return new RegExp(`(?<![\\w-])${escapeForPattern(key)}(?![\\w-])`, 'i').test(title)
}

export function agentForCard(card: QuestCard, agents: OfficeAgent[]): OfficeAgent | null {
  const { loop } = card
  const session = loop?.session
  const bySession = session ? newest(agents.filter((agent) => agent.session === session)) : null
  if (bySession) {
    return bySession
  }
  const worktree = loop?.worktree
  const byWorktree = worktree ? newest(agents.filter((agent) => agent.worktree === worktree)) : null
  if (byWorktree) {
    return byWorktree
  }
  const key = card.key
  return key ? newest(agents.filter((agent) => mentionsKey(agent.title, key))) : null
}

function runningSprintNames(sprints: Sprint[], space: string): string[] | null {
  const running = sprints.filter((sprint) => sprint.space === space && sprint.state === 'running')
  return running.length === 0 ? null : running.map((sprint) => sprint.name)
}

function matchesSprint(card: QuestCard, sprints: Sprint[], choice: SprintChoice): boolean {
  if (choice.kind === 'all') {
    return true
  }
  if (choice.kind === 'named') {
    return card.sprint === choice.name
  }
  const names = runningSprintNames(sprints, card.space)
  return names === null || (card.sprint !== null && names.includes(card.sprint))
}

export function matchesSpace(card: QuestCard, filter: BoardFilter): boolean {
  return filter.space === null || card.space === filter.space
}

export function matchesFilter(card: QuestCard, sprints: Sprint[], filter: BoardFilter): boolean {
  return matchesSpace(card, filter) && matchesSprint(card, sprints, filter.sprint)
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort()
}

export function filterOptions(snapshot: BoardSnapshot): FilterOptions {
  return {
    spaces: unique(snapshot.cards.map((card) => card.space)),
    sprints: unique(snapshot.sprints.map((sprint) => sprint.name))
  }
}

function toItem(card: QuestCard, agents: OfficeAgent[]): BoardItem {
  const agent = agentForCard(card, agents)
  return { card, agent, reason: waitReason(card, agent) }
}

function sortWaiting(items: BoardItem[]): BoardItem[] {
  const rank = (item: BoardItem): number => (item.reason ? WAIT_ORDER.indexOf(item.reason) : WAIT_ORDER.length)
  return [...items].sort((a, b) => rank(a) - rank(b) || b.card.updatedAt.localeCompare(a.card.updatedAt))
}

export function boardView(snapshot: BoardSnapshot, agents: OfficeAgent[], filter: BoardFilter, today: Date = new Date()): BoardView {
  const inSpace = snapshot.cards.filter((card) => matchesSpace(card, filter)).map((card) => toItem(card, agents))
  const inFilter = inSpace.filter((item) => matchesFilter(item.card, snapshot.sprints, filter))
  return {
    waiting: sortWaiting(inSpace.filter((item) => item.reason !== null)),
    rounds: releaseRounds(inFilter, snapshot.sprints, filter, today),
    columns: groupByColumn(inFilter.filter((item) => item.reason === null))
  }
}
