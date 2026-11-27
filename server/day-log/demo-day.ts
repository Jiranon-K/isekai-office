import type { DayEvent, DayLog } from '@shared/day-log'
import type { AgentState } from '@shared/types'
import type { StationId } from '@shared/stations'
import { localDate } from './events'

const AGENTS: Record<string, { title: string; repo: string }> = {
  a1: { title: 'Fix login redirect', repo: 'web' },
  a2: { title: 'Refactor billing module', repo: 'api' },
  a3: { title: 'Write API changelog', repo: 'docs' }
}

type Clock = { at(time: string): number }

function clockOn(midnight: Date): Clock {
  return {
    at(time) {
      const [hours = 0, minutes = 0] = time.split(':').map(Number)
      return new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate(), hours, minutes).getTime()
    }
  }
}

function watch(clock: Clock, time: string, on: boolean): DayEvent {
  return { kind: 'watch', at: clock.at(time), on }
}

function station(clock: Clock, time: string, agentId: string, where: StationId): DayEvent {
  return { kind: 'station', at: clock.at(time), agentId, station: where }
}

function state(clock: Clock, time: string, agentId: string, from: AgentState | null, to: AgentState | null): DayEvent {
  const agent = AGENTS[agentId]
  return { kind: 'state', at: clock.at(time), agentId, title: agent?.title ?? agentId, repo: agent?.repo ?? null, from, to }
}

function morning(clock: Clock): DayEvent[] {
  return [
    watch(clock, '09:00', true),
    state(clock, '09:02', 'a1', null, 'working'),
    station(clock, '09:02', 'a1', 'forge'),
    station(clock, '09:05', 'a1', 'archive'),
    station(clock, '09:12', 'a1', 'desk'),
    state(clock, '09:30', 'a2', null, 'working'),
    station(clock, '09:30', 'a2', 'archive'),
    state(clock, '09:41', 'a1', 'working', 'waiting'),
    state(clock, '10:15', 'a1', 'waiting', 'working'),
    station(clock, '10:15', 'a1', 'desk'),
    station(clock, '10:20', 'a2', 'desk'),
    state(clock, '11:02', 'a2', 'working', 'blocked'),
    state(clock, '11:30', 'a2', 'blocked', 'working'),
    station(clock, '11:30', 'a2', 'forge'),
    state(clock, '11:55', 'a1', 'working', 'done'),
    watch(clock, '12:00', false)
  ]
}

function afternoon(clock: Clock): DayEvent[] {
  return [
    watch(clock, '13:00', true),
    state(clock, '13:05', 'a3', null, 'working'),
    station(clock, '13:05', 'a3', 'archive'),
    station(clock, '13:40', 'a3', 'crystal'),
    state(clock, '14:10', 'a3', 'working', 'waiting'),
    state(clock, '14:50', 'a3', 'waiting', 'working'),
    station(clock, '14:50', 'a3', 'desk'),
    state(clock, '15:30', 'a2', 'working', 'done'),
    state(clock, '16:05', 'a3', 'working', 'done'),
    watch(clock, '17:00', false)
  ]
}

export function demoDayDate(now = Date.now()): string {
  return localDate(now)
}

export function demoDay(now = Date.now()): DayLog {
  const clock = clockOn(new Date(now))
  return { date: demoDayDate(now), events: [...morning(clock), ...afternoon(clock)] }
}
