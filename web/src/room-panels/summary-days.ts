import { localDateOf } from '@/replay/replay-format'

const DAY_MS = 24 * 60 * 60 * 1000

export type SummaryDayOption = { date: string; label: string; ledgerDay: string }

export function summaryDayOptions(days: readonly string[], now: number = Date.now()): SummaryDayOption[] {
  const today = localDateOf(now)
  const yesterday = localDateOf(now - DAY_MS)
  const others = days.filter((date) => date !== today && date !== yesterday).sort().reverse()
  return [
    { date: today, label: 'วันนี้', ledgerDay: 'today' },
    { date: yesterday, label: 'เมื่อวาน', ledgerDay: 'yesterday' },
    ...others.map((date) => ({ date, label: date, ledgerDay: date }))
  ]
}
