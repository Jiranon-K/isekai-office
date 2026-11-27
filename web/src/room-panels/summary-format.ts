import { formatGold, formatMoney } from '@/ledger/ledger-logic'
import { formatClock } from '@/replay/replay-format'
import type { DaySummary } from './summary-logic'

const MINUTE_MS = 60_000

export const EMPTY_DAY_NOTE = 'ยังไม่มีข้อมูลของวันนี้'

export function formatDuration(ms: number): string {
  if (ms <= 0) {
    return '0 นาที'
  }
  const minutes = Math.max(1, Math.round(ms / MINUTE_MS))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) {
    return `${rest} นาที`
  }
  return rest === 0 ? `${hours} ชม.` : `${hours} ชม. ${rest} นาที`
}

export function formatHourRange(hour: number): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(hour)}:00–${pad((hour + 1) % 24)}:00 น.`
}

export function watchedNote(watchedMs: number): string {
  const minutes = Math.round(watchedMs / MINUTE_MS)
  return `นับเฉพาะช่วงที่เปิดแท็บไว้ (รวม ${Math.floor(minutes / 60)} ชม. ${minutes % 60} นาที)`
}

export const UNWATCHED_NOTE = 'วันนี้ไม่มีช่วงที่เปิดแท็บไว้ จึงนับเวลาไม่ได้'

export function isUnwatchedDay(summary: DaySummary): boolean {
  return summary.watchedMs === 0
}

export function spendText(summary: DaySummary): string | null {
  if (!summary.spend) {
    return null
  }
  const text = `${formatGold(summary.spend.amount)} (${formatMoney(summary.spend.amount, summary.spend.currency || null)})`
  const unpriced = summary.spend.unpricedSessions
  return unpriced > 0 ? `${text} · ไม่รวม ${unpriced} session ที่ไม่มีราคา` : text
}

export function isEmptyDay(summary: DaySummary): boolean {
  return summary.sessions === 0
}

export function longestWaitText(summary: DaySummary): string | null {
  const longest = summary.longestWait
  if (!longest) {
    return null
  }
  return `${longest.title} · ${formatDuration(longest.ms)} · เริ่ม ${formatClock(longest.at)} น.`
}

export function medianText(summary: DaySummary): string | null {
  return summary.medianWaitMs === null ? null : formatDuration(summary.medianWaitMs)
}

export function busiestHourText(summary: DaySummary): string | null {
  return summary.busiestHour === null ? null : formatHourRange(summary.busiestHour)
}
