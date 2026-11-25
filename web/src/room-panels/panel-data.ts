import type { BoardSnapshot, OfficeAgent, QuestCard } from '@shared/types'
import { boardView, DEFAULT_FILTER } from '@/board/monitor-logic'
import { manaRatio } from '@/office/scene/mana'
import { needsDecision } from '@/agent/panel-logic'

export type LoadRow = { agent: OfficeAgent; ratio: number | null }

const STAGE_ORDER = ['blocked', 'design_ready', 'mr_open', 'working', 'designing', 'queued', 'merged']

function byNewest(first: OfficeAgent, second: OfficeAgent): number {
  return second.updatedAt - first.updatedAt
}

export function rosterOrder(agents: OfficeAgent[]): OfficeAgent[] {
  const rank = (agent: OfficeAgent): number => (needsDecision(agent.state) ? 0 : 1)
  return [...agents].sort((first, second) => rank(first) - rank(second) || byNewest(first, second))
}

export function loadRows(agents: OfficeAgent[], contextWindow: number): LoadRow[] {
  const rows = agents.map((agent) => ({ agent, ratio: manaRatio(agent.contextTokens, contextWindow) }))
  return rows.sort((first, second) => (second.ratio ?? -1) - (first.ratio ?? -1))
}

export function doneSessions(agents: OfficeAgent[]): OfficeAgent[] {
  return agents.filter((agent) => agent.state === 'done').sort(byNewest)
}

export function cardsToVerify(snapshot: BoardSnapshot | null): QuestCard[] {
  return (snapshot?.cards ?? []).filter((card) => card.column !== 'done' && card.loop?.status === 'mr_open')
}

function stageRank(card: QuestCard): number {
  const index = STAGE_ORDER.indexOf(card.loop?.status ?? '')
  return index === -1 ? STAGE_ORDER.length : index
}

export function loopHistory(snapshot: BoardSnapshot | null): QuestCard[] {
  const cards = (snapshot?.cards ?? []).filter((card) => card.loop !== null)
  return cards.sort((first, second) => stageRank(first) - stageRank(second) || second.updatedAt.localeCompare(first.updatedAt))
}

export function waitingCount(snapshot: BoardSnapshot | null, agents: OfficeAgent[]): number {
  return snapshot ? boardView(snapshot, agents, DEFAULT_FILTER).waiting.length : 0
}
