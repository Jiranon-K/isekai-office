import { describe, expect, test } from 'bun:test'
import type { DayEvent } from '@shared/day-log'
import type { AgentState } from '@shared/types'
import type { StationId } from '@shared/stations'
import { gaps } from './replay-geometry'
import { stepPlayback } from './playback-logic'
import { agentsAt, buildReplayDay, groupOfReplay, isWatched, lanes, limitLanes, nextEventAt, nextWatchedAt, previousEventAt, toOfficeAgent, watchedSpans } from './replay-logic'

const HOUR = 3_600_000
const MINUTE = 60_000
const MIDNIGHT = Date.UTC(2026, 10, 27)

function at(hours: number, minutes = 0): number {
  return MIDNIGHT + hours * HOUR + minutes * MINUTE
}

function state(time: number, agentId: string, from: AgentState | null, to: AgentState | null): DayEvent {
  return { kind: 'state', at: time, agentId, title: `title ${agentId}`, repo: 'web', from, to }
}

function station(time: number, agentId: string, where: StationId): DayEvent {
  return { kind: 'station', at: time, agentId, station: where }
}

function watch(time: number, on: boolean): DayEvent {
  return { kind: 'watch', at: time, on }
}

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
    expect(agentsAt(events, at(10))).toEqual([{ agentId: 'a', title: 'title a', repo: 'web', state: 'working', station: 'archive' }])
  })

  test('includes an event that happened exactly at the moment', () => {
    expect(agentsAt(events, at(9, 30))).toHaveLength(1)
  })

  test('drops the station when the agent stops working', () => {
    expect(agentsAt(events, at(10, 30))[0]).toMatchObject({ state: 'waiting', station: null })
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

describe('watchedSpans and isWatched', () => {
  test('turns each on and off pair into a span', () => {
    const events = [watch(at(9), true), watch(at(12), false), watch(at(13), true), watch(at(17), false)]
    expect(watchedSpans(events)).toEqual([
      { from: at(9), to: at(12) },
      { from: at(13), to: at(17) }
    ])
  })

  test('closes a span with a missing off at the last event', () => {
    const events = [watch(at(9), true), state(at(9, 5), 'a', null, 'working'), state(at(10), 'a', 'working', 'done')]
    expect(watchedSpans(events)).toEqual([{ from: at(9), to: at(10) }])
  })

  test('closes a session at the last event before the next on', () => {
    const events = [watch(at(9), true), state(at(10), 'a', null, 'working'), watch(at(13), true), watch(at(14), false)]
    expect(watchedSpans(events)).toEqual([
      { from: at(9), to: at(10) },
      { from: at(13), to: at(14) }
    ])
  })

  test('opens a span at the first event when the day starts with an off', () => {
    const events = [state(at(0, 5), 'a', null, 'working'), watch(at(1), false), watch(at(9), true), watch(at(10), false)]
    expect(watchedSpans(events)).toEqual([
      { from: at(0, 5), to: at(1) },
      { from: at(9), to: at(10) }
    ])
  })

  test('ignores an off that follows an off once the first span exists', () => {
    const events = [watch(at(9), true), watch(at(10), false), watch(at(11), false)]
    expect(watchedSpans(events)).toEqual([{ from: at(9), to: at(10) }])
  })

  test('has no spans on an empty day', () => {
    expect(watchedSpans([])).toEqual([])
  })

  test('treats a day without watch events as watched from the first to the last event', () => {
    const events = [state(at(9), 'a', null, 'working'), state(at(10), 'a', 'working', 'done')]
    expect(watchedSpans(events)).toEqual([{ from: at(9), to: at(10) }])
  })

  test('plays a day without watch events to its end instead of ending at once', () => {
    const events = [state(at(9), 'a', null, 'working'), state(at(10), 'a', 'working', 'done')]
    const day = buildReplayDay('2026-11-27', events)
    expect(stepPlayback(day, at(9), 100, 30)).toEqual({ at: at(9) + 3000, ended: false })
    expect(gaps(day)).toEqual([])
  })

  test('treats the edges as watched and the middle of a gap as not', () => {
    const spans = [
      { from: at(9), to: at(12) },
      { from: at(13), to: at(17) }
    ]
    expect(isWatched(spans, at(9))).toBe(true)
    expect(isWatched(spans, at(12))).toBe(true)
    expect(isWatched(spans, at(12, 30))).toBe(false)
    expect(nextWatchedAt(spans, at(12, 30))).toBe(at(13))
    expect(nextWatchedAt(spans, at(14))).toBeNull()
  })
})

describe('lanes', () => {
  test('draws a wait from 10:05 to 10:40 as one span', () => {
    const events = [
      state(at(9), 'a', null, 'working'),
      state(at(10, 5), 'a', 'working', 'waiting'),
      state(at(10, 40), 'a', 'waiting', 'working'),
      state(at(11), 'a', 'working', null)
    ]
    const [lane] = lanes(events)
    expect(lane?.waits).toEqual([{ from: at(10, 5), to: at(10, 40) }])
    expect(lane?.present).toEqual([{ from: at(9), to: at(11) }])
  })

  test('counts blocked as a wait and merges waiting into blocked', () => {
    const events = [
      state(at(9), 'a', null, 'working'),
      state(at(9, 10), 'a', 'working', 'waiting'),
      state(at(9, 20), 'a', 'waiting', 'blocked'),
      state(at(9, 30), 'a', 'blocked', 'working')
    ]
    expect(lanes(events)[0]?.waits).toEqual([{ from: at(9, 10), to: at(9, 30) }])
  })

  test('orders lanes by first appearance and splits presence on a departure', () => {
    const events = [
      state(at(9), 'b', null, 'working'),
      state(at(9, 10), 'a', null, 'working'),
      state(at(9, 20), 'b', 'working', null),
      state(at(9, 40), 'b', null, 'working'),
      state(at(10), 'a', 'working', null)
    ]
    const all = lanes(events)
    expect(all.map((lane) => lane.agentId)).toEqual(['b', 'a'])
    expect(all[0]?.present).toEqual([
      { from: at(9), to: at(9, 20) },
      { from: at(9, 40), to: at(10) }
    ])
  })

  test('keeps a wait that is still open at the end of the day', () => {
    const events = [state(at(9), 'a', null, 'working'), state(at(10), 'a', 'working', 'waiting'), watch(at(11), false)]
    expect(lanes(events)[0]?.waits).toEqual([{ from: at(10), to: at(11) }])
  })

  test('splits a presence that crosses a gap', () => {
    const events = [
      watch(at(9), true),
      state(at(10), 'a', null, 'working'),
      watch(at(11), false),
      watch(at(13), true),
      state(at(14), 'a', 'working', null)
    ]
    expect(lanes(events)[0]?.present).toEqual([
      { from: at(10), to: at(11) },
      { from: at(13), to: at(14) }
    ])
  })

  test('splits a wait that crosses a gap so nothing is drawn over it', () => {
    const events = [
      watch(at(9), true),
      state(at(11), 'a', null, 'waiting'),
      watch(at(12), false),
      watch(at(13), true),
      state(at(14), 'a', 'waiting', 'working')
    ]
    expect(lanes(events)[0]?.waits).toEqual([
      { from: at(11), to: at(12) },
      { from: at(13), to: at(14) }
    ])
  })

  test('limits the lanes and counts the rest', () => {
    const many = Array.from({ length: 13 }, (_, index) => ({ agentId: `a${index}`, title: 't', waits: [], present: [] }))
    expect(limitLanes(many).shown).toHaveLength(10)
    expect(limitLanes(many).hidden).toBe(3)
    expect(limitLanes(many.slice(0, 4)).hidden).toBe(0)
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
    expect(previousEventAt(events, at(9, 30))).toBe(at(9))
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
  const replayAgent = { agentId: 'a', title: 'one', repo: 'web', state: 'working' as const, station: 'archive' as const }

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
