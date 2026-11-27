import type { DayEvent } from '@shared/day-log'
import type { AgentState } from '@shared/types'
import type { StationId } from '@shared/stations'

export const HOUR = 3_600_000
export const MINUTE = 60_000
export const MIDNIGHT = Date.UTC(2026, 10, 27)

export function at(hours: number, minutes = 0): number {
  return MIDNIGHT + hours * HOUR + minutes * MINUTE
}

export function state(time: number, agentId: string, from: AgentState | null, to: AgentState | null): DayEvent {
  return { kind: 'state', at: time, agentId, title: `title ${agentId}`, repo: 'web', from, to }
}

export function station(time: number, agentId: string, where: StationId): DayEvent {
  return { kind: 'station', at: time, agentId, station: where }
}

export function watch(time: number, on: boolean): DayEvent {
  return { kind: 'watch', at: time, on }
}
