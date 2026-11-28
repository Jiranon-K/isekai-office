import { describe, expect, test } from 'bun:test'
import type { DayEvent } from '@shared/day-log'
import { at, MIDNIGHT, state, station, watch } from './replay-fixtures'
import { agentsAt, buildReplayDay, groupOfReplay, nextEventAt, previousEventAt, toOfficeAgent } from './replay-logic'

describe('agentsAt', () => {
  const events = [
    watch(at(9), true),
    state(at(9, 30), 'a', null, 'working'),
    station(at(9, 30), 'a', 'archive'),
    state(at(10, 5), 'a', 'working', 'waiting'),
    state(at(11), 'a', 'waiting', null),
    watch(at(12), false)
  ]

  test('does not include an agent before its first event', () => {
    expect(agentsAt(events, at(9, 29))).toEqual([])
  })

  test('puts a working agent at the station it was recorded at', () => {
    expect(agentsAt(events, at(10))).toEqual([{ agentId: 'a', title: 'title a', repo: 'web', state: 'working', station: 'archive', stateSince: at(9, 30) }])
  })

  test('includes an event that happened exactly at the moment', () => {
    expect(agentsAt(events, at(9, 30))).toHaveLength(1)
  })

  test('drops the station when the agent stops working', () => {
    expect(agentsAt(events, at(10, 30))[0]).toMatchObject({ state: 'waiting', station: null })
  })

  test('sets the time of the event that started the current state', () => {
    expect(agentsAt(events, at(10, 30))[0]).toMatchObject({ state: 'waiting', stateSince: at(10, 5) })
  })

  test('does not include an agent after it left', () => {
    expect(agentsAt(events, at(11))).toEqual([])
    expect(agentsAt(events, at(11, 30))).toEqual([])
  })

  test('brings an agent back when it returns', () => {
    const returned = [...events, state(at(13), 'a', null, 'working'), station(at(13), 'a', 'forge')]
    expect(agentsAt(returned, at(13, 1))[0]).toMatchObject({ state: 'working', station: 'forge' })
  })

  test('ignores a station event for an agent that is not in the room', () => {
    expect(agentsAt([station(at(9), 'ghost', 'desk')], at(10))).toEqual([])
  })

  test('applies a station written just before the first state of the same moment', () => {
    const early = [station(at(9), 'a', 'archive'), state(at(9), 'a', null, 'working')]
    expect(agentsAt(early, at(9))[0]).toMatchObject({ state: 'working', station: 'archive' })
  })

  test('forgets a station for an agent that arrives at a later moment or does not work', () => {
    expect(agentsAt([station(at(9), 'a', 'archive'), state(at(10), 'a', null, 'working')], at(10))[0]).toMatchObject({ station: null })
    expect(agentsAt([station(at(9), 'a', 'archive'), state(at(9), 'a', null, 'waiting')], at(9))[0]).toMatchObject({ station: null })
  })

  test('returns nothing for an empty day', () => {
    expect(agentsAt([], at(10))).toEqual([])
  })

  test('folds a day of 5000 events in under 2 ms', () => {
    const many: DayEvent[] = []
    for (let index = 0; index < 5000; index += 1) {
      const agentId = `agent-${index % 12}`
      many.push(index % 2 === 0 ? state(MIDNIGHT + index * 5000, agentId, null, 'working') : station(MIDNIGHT + index * 5000, agentId, 'desk'))
    }
    agentsAt(many, MIDNIGHT + 5000 * 5000)
    const started = performance.now()
    agentsAt(many, MIDNIGHT + 5000 * 5000)
    expect(performance.now() - started).toBeLessThan(2)
  })
})

describe('arrow navigation', () => {
  const events = [watch(at(9), true), state(at(9, 30), 'a', null, 'working'), station(at(9, 30), 'a', 'desk'), state(at(10), 'a', 'working', 'done')]

  test('lands exactly on the next event time', () => {
    expect(nextEventAt(events, at(9))).toBe(at(9, 30))
    expect(nextEventAt(events, at(9, 15))).toBe(at(9, 30))
    expect(nextEventAt(events, at(9, 30))).toBe(at(10))
  })

  test('lands exactly on the previous event time', () => {
    expect(previousEventAt(events, at(10))).toBe(at(9, 30))
    expect(previousEventAt(events, at(9, 45))).toBe(at(9, 30))
    expect(previousEventAt(events, at(9, 30))).toBeNull()
  })

  test('steps over watch markers where the room does not change', () => {
    const marked = [state(at(9), 'a', null, 'working'), watch(at(9, 10), false), watch(at(9, 20), true), state(at(10), 'a', 'working', 'done'), watch(at(11), false)]
    expect(nextEventAt(marked, at(9))).toBe(at(10))
    expect(previousEventAt(marked, at(10))).toBe(at(9))
    expect(nextEventAt(marked, at(10))).toBeNull()
    expect(previousEventAt(marked, at(9, 15))).toBe(at(9))
    expect(previousEventAt([watch(at(9), true), state(at(9, 30), 'a', null, 'working')], at(9, 30))).toBeNull()
  })

  test('returns null past either end of the day', () => {
    expect(nextEventAt(events, at(10))).toBeNull()
    expect(previousEventAt(events, at(9))).toBeNull()
    expect(nextEventAt([], at(9))).toBeNull()
    expect(previousEventAt([], at(9))).toBeNull()
  })
})

describe('buildReplayDay', () => {
  test('describes an empty day', () => {
    expect(buildReplayDay('2026-11-27', [])).toEqual({ date: '2026-11-27', start: 0, end: 0, watched: [], lanes: [] })
  })

  test('spans from the first to the last event', () => {
    const day = buildReplayDay('2026-11-27', [watch(at(9), true), watch(at(12), false)])
    expect(day).toMatchObject({ start: at(9), end: at(12), watched: [{ from: at(9), to: at(12) }] })
  })
})

describe('toOfficeAgent and groupOfReplay', () => {
  const replayAgent = { agentId: 'a', title: 'one', repo: 'web', state: 'working' as const, station: 'archive' as const, stateSince: 0 }

  test('fills the rest with nulls', () => {
    expect(toOfficeAgent(replayAgent)).toMatchObject({ id: 'a', title: 'one', repo: 'web', terminal: null, contextTokens: null, tool: null, session: null })
  })

  test('puts a working agent at its recorded station', () => {
    expect(groupOfReplay([replayAgent])(toOfficeAgent(replayAgent))).toBe('archive')
  })

  test('falls back to the forge without a recorded station', () => {
    const lost = { ...replayAgent, station: null }
    expect(groupOfReplay([lost])(toOfficeAgent(lost))).toBe('forge')
  })

  test('sends waiting and done agents to the queue and the bar', () => {
    const waiting = { ...replayAgent, state: 'waiting' as const, station: null }
    const done = { ...replayAgent, state: 'done' as const, station: null }
    expect(groupOfReplay([waiting])(toOfficeAgent(waiting))).toBe('queue')
    expect(groupOfReplay([done])(toOfficeAgent(done))).toBe('bar')
  })
})
