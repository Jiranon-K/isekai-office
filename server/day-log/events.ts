import type { DayEvent } from '@shared/day-log'
import type { StationId } from '@shared/stations'
import { stationForTool } from '@shared/stations'
import type { LogEvent, OfficeAgent } from '@shared/types'

export type StationMemory = ReadonlyMap<string, StationId>

export const NO_STATIONS: StationMemory = new Map()

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

export function localDate(at: number): string {
  const moment = new Date(at)
  return `${moment.getFullYear()}-${twoDigits(moment.getMonth() + 1)}-${twoDigits(moment.getDate())}`
}

export function watchEvent(at: number, on: boolean): DayEvent {
  return { kind: 'watch', at, on }
}

export function stateEvents(events: LogEvent[], previous: OfficeAgent[], current: OfficeAgent[]): DayEvent[] {
  const repos = new Map([...previous, ...current].map((agent) => [agent.id, agent.repo]))
  return events.map((event): DayEvent => ({ kind: 'state', repo: repos.get(event.agentId) ?? null, ...event }))
}

export function stationEvents(memory: StationMemory, agents: OfficeAgent[], at: number): { events: DayEvent[]; memory: StationMemory } {
  const next = new Map<string, StationId>()
  const events: DayEvent[] = []
  for (const agent of agents) {
    if (agent.state !== 'working') {
      continue
    }
    const station = stationForTool(agent.tool)
    next.set(agent.id, station)
    if (memory.get(agent.id) !== station) {
      events.push({ kind: 'station', at, agentId: agent.id, station })
    }
  }
  return { events, memory: next }
}

export function stateOnly(events: DayEvent[]): LogEvent[] {
  return events.flatMap((event) => {
    if (event.kind !== 'state') {
      return []
    }
    const { at, agentId, title, from, to } = event
    return [{ at, agentId, title, from, to }]
  })
}
