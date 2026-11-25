import type { BoardColumn, OfficeAgent, QuestCard } from '@shared/types'

export const COLUMN_ORDER: BoardColumn[] = ['todo', 'doing', 'review', 'done']

export const COLUMN_TITLES: Record<BoardColumn, string> = {
  todo: 'ยังไม่เริ่ม',
  doing: 'กำลังทำ',
  review: 'รอ review',
  done: 'เสร็จ'
}

const LOOP_STAGE_LABELS: Record<string, string> = {
  designing: 'กำลังออกแบบ',
  design_ready: 'รอตรวจ design',
  queued: 'รอคิว',
  working: 'กำลังทำ',
  blocked: 'ติดอยู่',
  mr_open: 'MR เปิดแล้ว',
  merged: 'merge แล้ว'
}

export function loopStageLabel(status: string): string {
  return LOOP_STAGE_LABELS[status] ?? status
}

export function groupByColumn<T extends { card: QuestCard }>(items: T[]): Record<BoardColumn, T[]> {
  const groups: Record<BoardColumn, T[]> = { todo: [], doing: [], review: [], done: [] }
  for (const item of items) {
    groups[item.card.column].push(item)
  }
  return groups
}

export function formatTokenCount(tokens: number): string {
  return tokens < 1000 ? String(tokens) : `${Math.round(tokens / 1000)}k`
}

export function isHighPriority(priority: string | null): boolean {
  if (!priority) {
    return false
  }
  const normalized = priority.toUpperCase()
  return normalized === 'HIGH' || normalized === 'URGENT'
}

export function visibleLabels(labels: string[]): string[] {
  return labels.filter((label) => label.startsWith('type:') || label.startsWith('risk:'))
}

export function sendableAgents(agents: OfficeAgent[]): OfficeAgent[] {
  return agents.filter((agent) => agent.terminal !== null)
}

export function loopStartPrompt(cardKey: string): string {
  return `/jk-loop:start ${cardKey}`
}

export type BoardErrorKind = 'missing_token' | 'unauthorized' | 'unreachable' | 'generic'

export function classifyBoardError(error: string): BoardErrorKind {
  if (error === 'missing_token' || error === 'unauthorized') {
    return error
  }
  if (error === 'server_unreachable') {
    return 'unreachable'
  }
  return 'generic'
}
