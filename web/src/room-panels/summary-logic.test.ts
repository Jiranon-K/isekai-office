import { describe, expect, test } from 'bun:test'
import type { DayEvent, DayLog } from '@shared/day-log'
import type { Ledger } from '@shared/ledger'
import type { AgentState } from '@shared/types'
import { busiestHourOf, medianOf, summarise } from './summary-logic'

const MINUTE = 60_000
const BASE = new Date(2026, 4, 10).getTime()

function at(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return BASE + (hours * 60 + minutes) * MINUTE
}

function state(time: string, from: AgentState | null, to: AgentState | null, agentId = 'a1'): DayEvent {
  return { kind: 'state', at: at(time), agentId, title: `title ${agentId}`, repo: 'web', from, to }
}

function watch(time: string, on: boolean): DayEvent {
  return { kind: 'watch', at: at(time), on }
}

function dayOf(events: DayEvent[]): DayLog {
  return { date: '2026-05-10', events }
}

function ledgerOf(total: number | null, unpricedRows = 0): Ledger {
  return { date: '2026-05-10', currency: 'USD', rows: [], total, unpricedRows, at: 0 }
}

describe('summarise waits', () => {
  test('two waits of 20 and 5 minutes are 25 minutes over 2 waits, longest 20', () => {
    const summary = summarise(
      dayOf([
        watch('09:00', true),
        state('09:00', null, 'working'),
        state('10:00', 'working', 'waiting'),
        state('10:20', 'waiting', 'working'),
        state('11:00', 'working', 'waiting'),
        state('11:05', 'waiting', 'working'),
        watch('12:00', false)
      ]),
      null
    )
    const agent = summary.agents[0]
    expect([agent?.waitingMs, agent?.waits, agent?.longestWaitMs]).toEqual([25 * MINUTE, 2, 20 * MINUTE])
    expect([summary.waitingMs, summary.waits]).toEqual([25 * MINUTE, 2])
    expect(summary.longestWait).toEqual({ title: 'title a1', ms: 20 * MINUTE, at: at('10:00') })
  })

  test('a wait across a 30 minute gap is 30 minutes shorter than its clock length', () => {
    const summary = summarise(
      dayOf([
        watch('09:00', true),
        state('09:00', null, 'working'),
        state('10:00', 'working', 'waiting'),
        watch('10:20', false),
        watch('10:50', true),
        state('11:10', 'waiting', 'working'),
        watch('12:00', false)
      ]),
      null
    )
    expect(summary.waitingMs).toBe(40 * MINUTE)
    expect(summary.waits).toBe(1)
  })

  test('a wait still open at the end counts up to the last watched moment', () => {
    const summary = summarise(dayOf([watch('09:00', true), state('09:00', null, 'working'), state('10:00', 'working', 'blocked'), watch('10:30', false)]), null)
    expect(summary.waitingMs).toBe(30 * MINUTE)
  })

  test('a wait with no watch end counts up to the last event, not to now', () => {
    const summary = summarise(dayOf([watch('09:00', true), state('10:00', null, 'waiting'), state('10:45', 'waiting', 'waiting')]), null)
    expect(summary.waitingMs).toBe(45 * MINUTE)
  })

  test('waiting followed by blocked is one wait', () => {
    const summary = summarise(
      dayOf([watch('09:00', true), state('09:00', null, 'waiting'), state('09:10', 'waiting', 'blocked'), state('09:30', 'blocked', 'working'), watch('10:00', false)]),
      null
    )
    expect([summary.waits, summary.waitingMs]).toEqual([1, 30 * MINUTE])
  })

  test('a day with no watch markers is watched from its first to its last event', () => {
    const summary = summarise(dayOf([state('09:00', null, 'waiting'), state('10:00', 'waiting', 'working')]), null)
    expect([summary.watchedMs, summary.waitingMs, summary.waits]).toEqual([60 * MINUTE, 60 * MINUTE, 1])
  })

  test('time outside every watched span counts for nothing', () => {
    const summary = summarise(
      dayOf([watch('08:00', true), watch('08:30', false), state('09:00', null, 'waiting'), state('10:00', 'waiting', 'working')]),
      null
    )
    expect([summary.watchedMs, summary.waitingMs, summary.waits]).toEqual([30 * MINUTE, 0, 0])
  })
})

describe('medianOf', () => {
  test('is the middle for an odd count, the mean of the middle two for an even count, null for none', () => {
    expect(medianOf([30, 10, 20])).toBe(20)
    expect(medianOf([40, 10, 20, 30])).toBe(25)
    expect(medianOf([])).toBeNull()
  })
})

describe('busiestHourOf', () => {
  test('is the local hour with the most working time, splitting a stretch at the hour', () => {
    expect(busiestHourOf([{ from: at('09:50'), to: at('11:30') }])).toBe(10)
    expect(busiestHourOf([{ from: at('09:00'), to: at('09:20') }, { from: at('14:00'), to: at('14:40') }])).toBe(14)
    expect(busiestHourOf([])).toBeNull()
  })
})

describe('summarise sessions', () => {
  const events = [
    watch('09:00', true),
    state('09:00', null, 'working', 'a1'),
    state('09:00', null, 'working', 'a2'),
    state('10:00', 'working', 'done', 'a1'),
    state('10:30', 'working', null, 'a2'),
    watch('11:00', false)
  ]

  test('counts an agent whose last state is done as finished and one that left while working as not', () => {
    const summary = summarise(dayOf(events), null)
    expect([summary.sessions, summary.finished]).toEqual([2, 1])
    expect(summary.agents.find((agent) => agent.agentId === 'a1')?.finished).toBe(true)
    expect(summary.agents.find((agent) => agent.agentId === 'a2')?.finished).toBe(false)
  })

  test('an agent whose only event today is leaving is not a session', () => {
    const summary = summarise(dayOf([...events, state('09:30', 'working', null, 'a4')]), null)
    expect(summary.sessions).toBe(2)
    expect(summary.agents.some((agent) => agent.agentId === 'a4')).toBe(false)
  })

  test('adds working time per agent and sorts agents by waiting time', () => {
    const summary = summarise(dayOf([...events, state('10:40', null, 'waiting', 'a3'), state('10:50', 'waiting', 'working', 'a3')]), null)
    expect(summary.agents[0]?.agentId).toBe('a3')
    expect(summary.agents.find((agent) => agent.agentId === 'a2')?.workingMs).toBe(90 * MINUTE)
    expect(summary.watchedMs).toBe(120 * MINUTE)
  })
})

describe('summarise spend and empty days', () => {
  const events = [watch('09:00', true), state('09:00', null, 'working'), watch('10:00', false)]

  test('has a spend line only when the ledger has a total', () => {
    expect(summarise(dayOf(events), ledgerOf(1.5)).spend).toEqual({ amount: 1.5, currency: 'USD', unpricedSessions: 0 })
    expect(summarise(dayOf(events), ledgerOf(null)).spend).toBeNull()
    expect(summarise(dayOf(events), null).spend).toBeNull()
  })

  test('carries the count of sessions the ledger could not price', () => {
    expect(summarise(dayOf(events), ledgerOf(1.5, 2)).spend?.unpricedSessions).toBe(2)
  })

  test('a day with no events has no sessions, no median and no longest wait', () => {
    const summary = summarise(dayOf([]), null)
    expect([summary.sessions, summary.waits, summary.medianWaitMs, summary.longestWait, summary.busiestHour]).toEqual([0, 0, null, null, null])
  })
})
