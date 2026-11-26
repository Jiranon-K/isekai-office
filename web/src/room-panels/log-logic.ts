import type { AgentState, LogEvent } from '@shared/types'

export const LAST_HIDDEN_KEY = 'isekai-office.lastHiddenAt'

const MINUTE_MS = 60_000

const STATE_TEXT: Record<AgentState, string> = {
  working: 'ทำงานต่อ',
  waiting: 'เริ่มรอคุณ',
  blocked: 'ติดอยู่',
  done: 'เสร็จแล้ว'
}

export function eventText(event: LogEvent): string {
  if (event.to === null) {
    return 'ออกไป'
  }
  if (event.from === null) {
    return 'เข้ามา'
  }
  return STATE_TEXT[event.to]
}

function isWaitState(state: AgentState | null): boolean {
  return state === 'waiting' || state === 'blocked'
}

export function waitedMs(events: LogEvent[], index: number): number | null {
  const ending = events[index]
  if (!ending || !isWaitState(ending.from)) {
    return null
  }
  const began = events.slice(index + 1).find((event) => event.agentId === ending.agentId && event.to === ending.from)
  return began ? ending.at - began.at : null
}

export function waitText(ms: number): string {
  return `รอ ${Math.max(1, Math.round(ms / MINUTE_MS))} นาที`
}

export function splitAtLastSeen(events: LogEvent[], lastSeenAt: number | null): { newer: LogEvent[]; older: LogEvent[] } {
  if (lastSeenAt === null) {
    return { newer: [], older: events }
  }
  return { newer: events.filter((event) => event.at > lastSeenAt), older: events.filter((event) => event.at <= lastSeenAt) }
}

export function parseLastSeen(raw: string | null): number | null {
  if (!raw) {
    return null
  }
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}
