import { describe, expect, test } from 'bun:test'
import type { AgentState, LogEvent, OfficeAgent, OfficeSnapshot } from '@shared/types'
import { appendEvents, diffEvents, guildLog, recordSnapshot, type LogState } from './log'

function agentIn(id: string, state: AgentState): OfficeAgent {
  return { id, title: `title ${id}`, repo: null, workspace: null, worktree: null, session: null, contextTokens: null, state, tool: null, lastMessage: null, updatedAt: 0, activeAt: 0, terminal: null }
}

function snapshotOf(agents: OfficeAgent[], at: number, extra: Partial<OfficeSnapshot> = {}): OfficeSnapshot {
  return { orcaRunning: true, agents, contextWindow: 1, quietAfterMs: 1, error: null, at, ...extra }
}

function eventAt(at: number): LogEvent {
  return { at, agentId: 'a', title: 'a', from: 'working', to: 'done' }
}

const FRESH: LogState = { agents: null, events: [] }

describe('diffEvents', () => {
  test('a state change gives one event with from and to', () => {
    expect(diffEvents([agentIn('a', 'working')], [agentIn('a', 'waiting')], 10)).toEqual([{ at: 10, agentId: 'a', title: 'title a', from: 'working', to: 'waiting' }])
  })

  test('an agent that appears has from null', () => {
    expect(diffEvents([], [agentIn('a', 'working')], 5)).toEqual([{ at: 5, agentId: 'a', title: 'title a', from: null, to: 'working' }])
  })

  test('an agent that leaves has to null and keeps its last title', () => {
    expect(diffEvents([agentIn('a', 'done')], [], 7)).toEqual([{ at: 7, agentId: 'a', title: 'title a', from: 'done', to: null }])
  })

  test('no change gives no events, even when other fields move', () => {
    const moved = { ...agentIn('a', 'working'), updatedAt: 99, title: 'renamed' }
    expect(diffEvents([agentIn('a', 'working')], [moved], 1)).toEqual([])
  })

  test('each agent that changed gets its own event', () => {
    const events = diffEvents([agentIn('a', 'working'), agentIn('b', 'working')], [agentIn('a', 'done'), agentIn('b', 'working'), agentIn('c', 'waiting')], 3)
    expect(events.map((event) => [event.agentId, event.from, event.to])).toEqual([
      ['a', 'working', 'done'],
      ['c', null, 'waiting']
    ])
  })
})

describe('appendEvents', () => {
  test('keeps the oldest first and adds the new events at the end', () => {
    expect(appendEvents([eventAt(1)], [eventAt(2), eventAt(3)]).map((event) => event.at)).toEqual([1, 2, 3])
  })

  test('event 101 drops the oldest', () => {
    const full = Array.from({ length: 100 }, (_, index) => eventAt(index + 1))
    const next = appendEvents(full, [eventAt(101)])
    expect(next).toHaveLength(100)
    expect(next[0]?.at).toBe(2)
    expect(next[99]?.at).toBe(101)
  })

  test('a batch larger than the limit keeps only the newest', () => {
    const next = appendEvents([], [eventAt(1), eventAt(2), eventAt(3)], 2)
    expect(next.map((event) => event.at)).toEqual([2, 3])
  })
})

describe('recordSnapshot', () => {
  test('working, waiting, working, done gives three events in order', () => {
    const steps: AgentState[] = ['working', 'waiting', 'working', 'done']
    const state = steps.reduce((current, step, index) => recordSnapshot(current, snapshotOf([agentIn('a', step)], (index + 1) * 10)), FRESH)
    expect(state.events.map((event) => [event.at, event.from, event.to])).toEqual([
      [20, 'working', 'waiting'],
      [30, 'waiting', 'working'],
      [40, 'working', 'done']
    ])
  })

  test('the first snapshot records nothing, so a restart does not log every agent as new', () => {
    const state = recordSnapshot(FRESH, snapshotOf([agentIn('a', 'working'), agentIn('b', 'done')], 1))
    expect(state.events).toEqual([])
    expect(state.agents).toHaveLength(2)
  })

  test('a failed tick adds no events and keeps the baseline', () => {
    const first = recordSnapshot(FRESH, snapshotOf([agentIn('a', 'working')], 1))
    const failed = recordSnapshot(first, snapshotOf([], 2, { error: 'boom' }))
    expect(failed).toBe(first)
    const next = recordSnapshot(failed, snapshotOf([agentIn('a', 'done')], 3))
    expect(next.events.map((event) => event.to)).toEqual(['done'])
  })

  test('a tick with Orca closed records nothing and keeps the baseline', () => {
    const first = recordSnapshot(FRESH, snapshotOf([agentIn('a', 'working')], 1))
    expect(recordSnapshot(first, snapshotOf([], 2, { orcaRunning: false }))).toBe(first)
  })
})

describe('guildLog', () => {
  test('lists the newest event first and leaves the input alone', () => {
    const events = [eventAt(1), eventAt(2), eventAt(3)]
    expect(guildLog(events).events.map((event) => event.at)).toEqual([3, 2, 1])
    expect(events.map((event) => event.at)).toEqual([1, 2, 3])
  })

  test('an empty log has the same shape', () => {
    expect(guildLog([])).toEqual({ events: [] })
  })
})
