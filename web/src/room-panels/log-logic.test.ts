import { describe, expect, test } from 'bun:test'
import type { AgentState, LogEvent } from '@shared/types'
import { eventText, parseLastSeen, splitAtLastSeen, waitedMs, waitText } from './log-logic'

const MINUTE = 60_000

function eventOf(at: number, from: AgentState | null, to: AgentState | null, agentId = 'a'): LogEvent {
  return { at, agentId, title: agentId, from, to }
}

describe('eventText', () => {
  test('each kind of change has its own Thai line', () => {
    expect(eventText(eventOf(0, 'working', 'waiting'))).toBe('เริ่มรอคุณ')
    expect(eventText(eventOf(0, 'waiting', 'working'))).toBe('ทำงานต่อ')
    expect(eventText(eventOf(0, 'working', 'done'))).toBe('เสร็จแล้ว')
    expect(eventText(eventOf(0, 'working', 'blocked'))).toBe('ติดอยู่')
    expect(eventText(eventOf(0, null, 'working'))).toBe('เข้ามา')
    expect(eventText(eventOf(0, 'done', null))).toBe('ออกไป')
  })

  test('an agent that leaves is reported as leaving whatever state it was in', () => {
    expect(eventText(eventOf(0, 'waiting', null))).toBe('ออกไป')
  })
})

describe('waitedMs', () => {
  const newestFirst = [
    eventOf(100 * MINUTE, 'working', 'done'),
    eventOf(60 * MINUTE, 'waiting', 'working'),
    eventOf(50 * MINUTE, 'working', 'blocked', 'b'),
    eventOf(20 * MINUTE, 'working', 'waiting'),
    eventOf(10 * MINUTE, null, 'working')
  ]

  test('the event that ended a wait carries the length of that wait', () => {
    expect(waitedMs(newestFirst, 1)).toBe(40 * MINUTE)
  })

  test('an event that did not end a wait has no wait', () => {
    expect(waitedMs(newestFirst, 0)).toBeNull()
    expect(waitedMs(newestFirst, 3)).toBeNull()
  })

  test('a blocked spell is measured the same way', () => {
    const events = [eventOf(90 * MINUTE, 'blocked', 'working', 'b'), ...newestFirst.slice(2)]
    expect(waitedMs(events, 0)).toBe(40 * MINUTE)
  })

  test('a wait that began before the log started has no length', () => {
    expect(waitedMs([eventOf(5, 'waiting', 'working')], 0)).toBeNull()
  })

  test('another agent waiting at the same time is not mixed in', () => {
    const events = [eventOf(30 * MINUTE, 'waiting', 'working', 'a'), eventOf(25 * MINUTE, 'working', 'waiting', 'b'), eventOf(10 * MINUTE, 'working', 'waiting', 'a')]
    expect(waitedMs(events, 0)).toBe(20 * MINUTE)
  })

  test('an index outside the list has no wait', () => {
    expect(waitedMs(newestFirst, 9)).toBeNull()
  })
})

describe('waitText', () => {
  test('shows whole minutes and never less than one', () => {
    expect(waitText(40 * MINUTE)).toBe('รอ 40 นาที')
    expect(waitText(20_000)).toBe('รอ 1 นาที')
  })
})

describe('splitAtLastSeen', () => {
  const events = [eventOf(30, null, 'working'), eventOf(20, 'working', 'done'), eventOf(10, null, 'working')]

  test('events newer than the last seen time go above the divider', () => {
    const { newer, older } = splitAtLastSeen(events, 15)
    expect(newer.map((event) => event.at)).toEqual([30, 20])
    expect(older.map((event) => event.at)).toEqual([10])
  })

  test('an event stamped exactly at the last seen time is not new', () => {
    expect(splitAtLastSeen(events, 20).newer.map((event) => event.at)).toEqual([30])
  })

  test('nothing newer means no divider', () => {
    expect(splitAtLastSeen(events, 30).newer).toEqual([])
  })

  test('with no last seen time there is no divider', () => {
    const { newer, older } = splitAtLastSeen(events, null)
    expect(newer).toEqual([])
    expect(older).toHaveLength(3)
  })

  test('an empty log splits into two empty lists', () => {
    expect(splitAtLastSeen([], 5)).toEqual({ newer: [], older: [] })
  })
})

describe('parseLastSeen', () => {
  test('reads a stored time and refuses anything else', () => {
    expect(parseLastSeen('1700000000000')).toBe(1_700_000_000_000)
    expect(parseLastSeen(null)).toBeNull()
    expect(parseLastSeen('')).toBeNull()
    expect(parseLastSeen('soon')).toBeNull()
    expect(parseLastSeen('-5')).toBeNull()
  })
})
