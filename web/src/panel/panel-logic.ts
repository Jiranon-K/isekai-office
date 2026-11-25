import type { AgentState, CommandResult } from '@shared/types'
import type { CommandStatus } from './use-command'

export const STATE_LABELS: Record<AgentState, string> = {
  working: 'กำลังทำงาน',
  waiting: 'รอคุณ',
  blocked: 'ติดอยู่',
  done: 'เสร็จแล้ว'
}

export function formatContextLoad(contextTokens: number | null, contextWindow: number): string | null {
  if (contextTokens === null || !(contextWindow > 0)) {
    return null
  }
  const percent = Math.round(Math.min(contextTokens / contextWindow, 1) * 100)
  return `${Math.round(contextTokens / 1000)}k · ${percent}%`
}

export function needsDecision(state: AgentState): boolean {
  return state === 'waiting' || state === 'blocked'
}

export function lastScreenLines(screen: string, limit: number): string {
  return screen.trimEnd().split('\n').slice(-limit).join('\n')
}

export function describeResult(result: CommandResult): string | null {
  return result.ok ? null : (result.error ?? 'unknown_error')
}

export function decisionLocked(kind: CommandStatus['kind'], answeredAt: number | null, updatedAt: number): boolean {
  if (kind === 'sending') {
    return true
  }
  return kind === 'sent' && answeredAt === updatedAt
}

export function shouldSubmitOnKey(key: string, shiftKey: boolean, composing: boolean): boolean {
  return key === 'Enter' && !shiftKey && !composing
}

const LONG_TEXT_CHARS = 420
const LONG_TEXT_LINES = 8
const END_SLACK_PX = 48
const TIME_FORMAT = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' })
const DAY_FORMAT = new Intl.DateTimeFormat('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })

export type ToolCount = { name: string; count: number }

export function toolCounts(tools: string[]): ToolCount[] {
  const counts = new Map<string, number>()
  for (const tool of tools) {
    counts.set(tool, (counts.get(tool) ?? 0) + 1)
  }
  return [...counts].map(([name, count]) => ({ name, count }))
}

export function isLongText(text: string): boolean {
  return text.length > LONG_TEXT_CHARS || text.split('\n').length > LONG_TEXT_LINES
}

export function isNearEnd(scrollTop: number, clientHeight: number, scrollHeight: number): boolean {
  return scrollHeight - scrollTop - clientHeight <= END_SLACK_PX
}

export function formatTime(at: number | null): string | null {
  return at === null ? null : TIME_FORMAT.format(at)
}

export function dayLabel(at: number | null): string | null {
  return at === null ? null : DAY_FORMAT.format(at)
}

export function startsNewDay(previous: number | null | undefined, current: number | null): boolean {
  if (current === null) {
    return false
  }
  return previous === null || previous === undefined || dayLabel(previous) !== dayLabel(current)
}

export function visibleStart(total: number, shown: number): number {
  return Math.max(0, total - shown)
}
