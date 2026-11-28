import type { AgentState } from '@shared/types'

export const STATE_LABELS: Record<AgentState, string> = {
  working: 'กำลังทำงาน',
  waiting: 'รอคำสั่ง',
  blocked: 'ติดขัด',
  done: 'เสร็จแล้ว',
}

const MINUTE_MS = 60_000
const MINUTES_PER_HOUR = 60
const UNDER_ONE_MINUTE = 'ไม่ถึง 1 นาที'

export function formatStateDuration(elapsedMs: number): string {
  const minutes = Math.floor(Math.max(0, elapsedMs) / MINUTE_MS)
  if (minutes === 0) {
    return UNDER_ONE_MINUTE
  }
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes} นาที`
  }
  return `${Math.floor(minutes / MINUTES_PER_HOUR)} ชม. ${minutes % MINUTES_PER_HOUR} นาที`
}

export function stateLine(state: AgentState, stateSince: number | null, now: number): string {
  if (stateSince === null || !Number.isFinite(stateSince)) {
    return STATE_LABELS[state]
  }
  const duration = formatStateDuration(now - stateSince)
  if (state === 'working') {
    return `ทำงานมา ${duration}`
  }
  if (state === 'waiting') {
    return `รอคุณมา ${duration}`
  }
  return `${STATE_LABELS[state]} ${duration}`
}
