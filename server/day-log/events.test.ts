import { describe, expect, test } from 'bun:test'
import { isDayDate } from '@shared/day-log'
import type { AgentState, LogEvent, OfficeAgent } from '@shared/types'
import { dayMaxBytesFrom, keepDaysFrom } from './config'
import { localDate, NO_STATIONS, stateEvents, stateOnly, stationEvents, watchEvent } from './events'

function agentAt(id: string, state: AgentState, tool: string | null = null, repo: string | null = null): OfficeAgent {
  return { id, title: `title ${id}`, repo, workspace: null, worktree: null, session: null, contextTokens: null, state, tool, lastMessage: null, updatedAt: 0, activeAt: 0, terminal: null, stateSince: 0 }
}

describe('stationEvents', () => {
  test('a working agent with no station on record gets one station event', () => {
    const { events, memory } = stationEvents(NO_STATIONS, [agentAt('a', 'working', 'Edit')], 5)
    expect(events).toEqual([{ kind: 'station', at: 5, agentId: 'a', station: 'desk' }])
    expect(memory.get('a')).toBe('desk')
  })

  test('moving from an edit tool to a read tool writes one event', () => {
    const first = stationEvents(NO_STATIONS, [agentAt('a', 'working', 'Edit')], 1)
    const second = stationEvents(first.memory, [agentAt('a', 'working', 'Read')], 2)
    expect(second.events).toEqual([{ kind: 'station', at: 2, agentId: 'a', station: 'archive' }])
  })

  test('staying at the same station writes nothing, even with another tool', () => {
    const first = stationEvents(NO_STATIONS, [agentAt('a', 'working', 'Read')], 1)
    expect(stationEvents(first.memory, [agentAt('a', 'working', 'Grep')], 2).events).toEqual([])
  })

  test('an agent that stops working is forgotten, so coming back is written again', () => {
    const first = stationEvents(NO_STATIONS, [agentAt('a', 'working', 'Read')], 1)
    const idle = stationEvents(first.memory, [agentAt('a', 'waiting')], 2)
    expect(idle.events).toEqual([])
    expect(idle.memory.has('a')).toBe(false)
    expect(stationEvents(idle.memory, [agentAt('a', 'working', 'Read')], 3).events).toHaveLength(1)
  })

  test('an agent that leaves the room is forgotten', () => {
    const first = stationEvents(NO_STATIONS, [agentAt('a', 'working', 'Read')], 1)
    expect(stationEvents(first.memory, [], 2).memory.size).toBe(0)
  })
})

describe('stateEvents and stateOnly', () => {
  const change: LogEvent = { at: 9, agentId: 'a', title: 'title a', from: 'working', to: null }

  test('a state event carries the repo of the agent, also when the agent left', () => {
    expect(stateEvents([change], [agentAt('a', 'working', null, 'web')], [])).toEqual([{ kind: 'state', repo: 'web', ...change }])
  })

  test('the repo is null when the agent is unknown', () => {
    expect(stateEvents([change], [], [])).toEqual([{ kind: 'state', repo: null, ...change }])
  })

  test('stateOnly gives back plain log events and drops the rest', () => {
    const mixed = [...stateEvents([change], [], []), watchEvent(1, true), ...stationEvents(NO_STATIONS, [agentAt('b', 'working')], 2).events]
    expect(stateOnly(mixed)).toEqual([change])
  })
})

describe('dates and limits', () => {
  test('localDate uses the local calendar day', () => {
    expect(localDate(new Date(2026, 10, 3, 23, 59).getTime())).toBe('2026-11-03')
    expect(localDate(new Date(2026, 10, 4, 0, 1).getTime())).toBe('2026-11-04')
  })

  test('only a plain date passes the date pattern', () => {
    for (const bad of ['../../etc', '2026-11-3', '2026-11-03/x', '2026-11-03\n', '', null]) {
      expect(isDayDate(bad)).toBe(false)
    }
    expect(isDayDate('2026-11-03')).toBe(true)
  })

  test('keep days and size cap fall back to their defaults on bad input', () => {
    expect(keepDaysFrom(undefined)).toBe(14)
    expect(keepDaysFrom('0')).toBe(14)
    expect(keepDaysFrom('3')).toBe(3)
    expect(dayMaxBytesFrom('abc')).toBe(5 * 1024 * 1024)
    expect(dayMaxBytesFrom('1000')).toBe(1000)
  })
})
