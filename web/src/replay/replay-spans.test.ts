import { describe, expect, test } from 'bun:test'
import { at, state, watch } from './replay-fixtures'
import { gaps } from './replay-geometry'
import { stepPlayback } from './playback-logic'
import { buildReplayDay, isWatched, lanes, limitLanes, nextWatchedAt, watchedSpans } from './replay-logic'

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
