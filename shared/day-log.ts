import type { StationId } from './stations'
import type { LogEvent } from './types'

export type DayEvent =
  | ({ kind: 'state'; repo: string | null } & LogEvent)
  | { kind: 'station'; at: number; agentId: string; station: StationId }
  | { kind: 'watch'; at: number; on: boolean }

export type DayLog = { date: string; events: DayEvent[] }

export type LogDays = { days: string[]; directory: string; keepDays: number }

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isDayDate(value: string | null): value is string {
  return value !== null && DATE_PATTERN.test(value)
}
