import type { BoardSnapshot, OfficeAgent, QuestCard } from '@shared/types'
import { loopStageLabel } from './board-logic'
import {
  agentForCard,
  DEFAULT_FILTER,
  matchesFilter,
  sprintChoiceFromValue,
  sprintChoiceValue,
  WAIT_LABELS,
  WAIT_ORDER,
  waitReason,
  type BoardFilter,
  type BoardItem,
  type WaitReason
} from './monitor-logic'

export const BOARD_TABS = ['inbox', 'loop', 'release', 'all'] as const
export type BoardTab = (typeof BOARD_TABS)[number]

export const TAB_LABELS: Record<BoardTab, string> = {
  inbox: 'รอผม',
  loop: 'สาย Loop',
  release: 'รอบ release',
  all: 'การ์ดทั้งหมด'
}

export type BoardQuery = { tab: BoardTab; filter: BoardFilter; search: string }

export type InboxGroup = { reason: WaitReason; label: string; items: BoardItem[] }

export type LoopLane = { stage: string; label: string; items: BoardItem[] }

export type NextStep = { label: string; agentId: string | null; href: string | null }

const LOOP_STAGES = ['designing', 'design_ready', 'queued', 'working', 'blocked', 'mr_open', 'merged']
const DEFAULT_SPRINT = sprintChoiceValue(DEFAULT_FILTER.sprint)

export function parseBoardQuery(search: string): BoardQuery {
  const params = new URLSearchParams(search)
  const tab = BOARD_TABS.find((known) => known === params.get('tab')) ?? 'inbox'
  const sprint = sprintChoiceFromValue(params.get('sprint') ?? DEFAULT_SPRINT)
  return { tab, filter: { space: params.get('space') || null, sprint }, search: params.get('q') ?? '' }
}

export function boardQueryParams(query: BoardQuery): Record<string, string> {
  const sprint = sprintChoiceValue(query.filter.sprint)
  return {
    ...(query.tab === 'inbox' ? {} : { tab: query.tab }),
    ...(query.filter.space ? { space: query.filter.space } : {}),
    ...(sprint === DEFAULT_SPRINT ? {} : { sprint }),
    ...(query.search ? { q: query.search } : {})
  }
}

export function matchesSearch(card: QuestCard, search: string): boolean {
  const needle = search.trim().toLowerCase()
  if (!needle) {
    return true
  }
  return `${card.key ?? ''} ${card.title}`.toLowerCase().includes(needle)
}

export function searchItems(items: BoardItem[], search: string): BoardItem[] {
  return items.filter((item) => matchesSearch(item.card, search))
}

export function filteredItems(snapshot: BoardSnapshot, agents: OfficeAgent[], filter: BoardFilter): BoardItem[] {
  return snapshot.cards
    .filter((card) => matchesFilter(card, snapshot.sprints, filter))
    .map((card) => {
      const agent = agentForCard(card, agents)
      return { card, agent, reason: waitReason(card, agent) }
    })
}

export function inboxGroups(waiting: BoardItem[]): InboxGroup[] {
  return WAIT_ORDER.map((reason) => ({
    reason,
    label: WAIT_LABELS[reason],
    items: waiting.filter((item) => item.reason === reason)
  })).filter((group) => group.items.length > 0)
}

export function loopLanes(items: BoardItem[]): LoopLane[] {
  const inLoop = items.filter((item) => item.card.loop !== null)
  const extra = [...new Set(inLoop.map((item) => item.card.loop?.status ?? ''))].filter((stage) => !LOOP_STAGES.includes(stage))
  return [...LOOP_STAGES, ...extra].map((stage) => ({
    stage,
    label: loopStageLabel(stage),
    items: inLoop.filter((item) => item.card.loop?.status === stage)
  }))
}

function mergeRequestUrl(card: QuestCard): string | null {
  return card.mergeRequest?.url ?? card.loop?.mr ?? null
}

export function nextStep(item: BoardItem): NextStep {
  const { card, agent, reason } = item
  if (reason === 'agent_asks' && agent) {
    return { label: 'ตอบ session', agentId: agent.id, href: null }
  }
  if (reason === 'blocked' && agent) {
    return { label: 'ดู session ที่ติด', agentId: agent.id, href: null }
  }
  if (reason === 'design_review') {
    return { label: 'ตรวจ design', agentId: null, href: card.url }
  }
  const mergeRequest = mergeRequestUrl(card)
  if (reason === 'verify_mr' && mergeRequest) {
    return { label: 'เปิด MR', agentId: null, href: mergeRequest }
  }
  return { label: 'เปิดใน Workspace', agentId: null, href: card.url }
}

export function spaceTone(space: string): 'blue' | 'violet' {
  const sum = [...space].reduce((total, letter) => total + letter.charCodeAt(0), 0)
  return sum % 2 === 1 ? 'blue' : 'violet'
}
