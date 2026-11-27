import { describe, expect, test } from 'bun:test'
import type { DayEvent } from '@shared/day-log'
import type { AgentState } from '@shared/types'
import { clipToWatched, stateSpans, totalLength } from './summary-spans'

const MINUTE = 60_000
const BASE = new Date(2026, 4, 10).getTime()

function at(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return BASE + (hours * 60 + minutes) * MINUTE
}

function state(time: string, from: AgentState | null, to: AgentState | null, agentId = 'a1'): DayEvent {
  return { kind: 'state', at: at(time), agentId, title: `title ${agentId}`, repo: null, from, to }
}

function watch(time: string, on: boolean): DayEvent {
  return { kind: 'watch', at: at(time), on }
}

describe('stateSpans', () => {
  test('turns each state change into a stretch of one state', () => {
    const spans = stateSpans([state('09:00', null, 'working'), state('10:00', 'working', 'waiting'), state('10:20', 'waiting', 'working'), state('11:00', 'working', 'done')])
    expect(spans.map((span) => [span.state, span.from, span.to])).toEqual([
      ['working', at('09:00'), at('10:00')],
      ['waiting', at('10:00'), at('10:20')],
      ['working', at('10:20'), at('11:00')]
    ])
  })

  test('ends the stretch when the agent leaves', () => {
    const spans = stateSpans([state('09:00', null, 'working'), state('09:30', 'working', null)])
    expect(spans).toHaveLength(1)
    expect(spans[0]?.to).toBe(at('09:30'))
  })

  test('closes a stretch still open at the last event of the day', () => {
    const spans = stateSpans([state('09:00', null, 'waiting'), watch('10:30', false)])
    expect(spans[0]?.to).toBe(at('10:30'))
  })

  test('keeps agents apart and ignores watch and station events', () => {
    const spans = stateSpans([
      state('09:00', null, 'working', 'a1'),
      state('09:10', null, 'waiting', 'a2'),
      { kind: 'station', at: at('09:15'), agentId: 'a1', station: 'forge' },
      state('09:30', 'working', 'done', 'a1'),
      state('09:40', 'waiting', 'working', 'a2')
    ])
    expect(spans.map((span) => [span.agentId, span.state])).toEqual([
      ['a1', 'working'],
      ['a2', 'waiting'],
      ['a1', 'done']
    ])
  })
})

describe('clipToWatched', () => {
  const span = { agentId: 'a1', title: 't', repo: null, state: 'waiting' as const, from: at('10:00'), to: at('11:00') }

  test('keeps a stretch inside a watched window whole', () => {
    expect(totalLength(clipToWatched([span], [{ from: at('09:00'), to: at('12:00') }]))).toBe(60 * MINUTE)
  })

  test('cuts the stretch at both edges of a gap', () => {
    const watched = [
      { from: at('09:00'), to: at('10:20') },
      { from: at('10:50'), to: at('12:00') }
    ]
    const pieces = clipToWatched([span], watched)
    expect(pieces).toHaveLength(2)
    expect(totalLength(pieces)).toBe(30 * MINUTE)
  })

  test('drops a stretch that lies wholly in a gap', () => {
    expect(clipToWatched([span], [{ from: at('12:00'), to: at('13:00') }])).toEqual([])
  })

  test('cuts a stretch that starts before the tab opened', () => {
    const pieces = clipToWatched([span], [{ from: at('10:30'), to: at('12:00') }])
    expect(pieces[0]?.from).toBe(at('10:30'))
  })
})
