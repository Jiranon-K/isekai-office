import type { ReplayDay, Span } from './replay-logic'

export function gaps(day: ReplayDay): Span[] {
  const found: Span[] = []
  let cursor = day.start
  for (const span of day.watched) {
    if (span.from > cursor) {
      found.push({ from: cursor, to: span.from })
    }
    cursor = Math.max(cursor, span.to)
  }
  if (cursor < day.end) {
    found.push({ from: cursor, to: day.end })
  }
  return found
}

export function percentOf(day: ReplayDay, at: number): number {
  const total = day.end - day.start
  if (total <= 0) {
    return 0
  }
  return Math.min(100, Math.max(0, ((at - day.start) / total) * 100))
}

export function spanStyle(day: ReplayDay, span: Span): { left: string; width: string } {
  const left = percentOf(day, span.from)
  return { left: `${left}%`, width: `${percentOf(day, span.to) - left}%` }
}
