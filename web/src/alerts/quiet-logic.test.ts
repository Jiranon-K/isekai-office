import { describe, expect, test } from 'bun:test'
import type { AgentState, OfficeAgent } from '@shared/types'
import { clockRuns, isQuiet, newlyQuiet, quietAlertText, quietMinutes, quietMinutesById } from './quiet-logic'

const MINUTE = 60_000
const NOW = 1_800_000_000_000
const LIMIT = 10 * MINUTE

function agent(id: string, state: AgentState, ageMs: number): OfficeAgent {
  return {
    id,
    title: `session ${id}`,
    repo: null,
    workspace: null,
    worktree: null,
    session: null,
    contextTokens: null,
    state,
    tool: null,
    lastMessage: null,
    updatedAt: 0,
    activeAt: NOW - ageMs,
    stateSince: 0,
    terminal: null
  }
}

function ids(agents: OfficeAgent[]): string[] {
  return agents.map((found) => found.id)
}

describe('isQuiet', () => {
  test('a working agent is quiet exactly at the threshold and not a millisecond before', () => {
    expect(isQuiet(agent('a', 'working', LIMIT - 1), NOW, LIMIT)).toBe(false)
    expect(isQuiet(agent('a', 'working', LIMIT), NOW, LIMIT)).toBe(true)
    expect(isQuiet(agent('a', 'working', LIMIT + 1), NOW, LIMIT)).toBe(true)
  })

  test('waiting, blocked and done agents are never quiet however old', () => {
    for (const state of ['waiting', 'blocked', 'done'] as const) {
      expect(isQuiet(agent('a', state, 24 * 60 * MINUTE), NOW, LIMIT)).toBe(false)
    }
  })

  test('a smaller threshold makes a younger agent quiet', () => {
    expect(isQuiet(agent('a', 'working', 2 * MINUTE), NOW, MINUTE)).toBe(true)
  })
})

describe('quietMinutes', () => {
  test('counts whole minutes since the last activity', () => {
    expect(quietMinutes(agent('a', 'working', 14 * MINUTE + 59_000), NOW)).toBe(14)
    expect(quietMinutes(agent('a', 'working', 0), NOW)).toBe(0)
  })

  test('a clock that is behind the agent gives zero', () => {
    expect(quietMinutes(agent('a', 'working', -5 * MINUTE), NOW)).toBe(0)
  })
})

describe('quietMinutesById', () => {
  test('holds only the quiet agents with their minutes', () => {
    const agents = [agent('a', 'working', 12 * MINUTE), agent('b', 'working', MINUTE), agent('c', 'waiting', 30 * MINUTE)]
    expect([...quietMinutesById(agents, NOW, LIMIT)]).toEqual([['a', 12]])
  })
})

describe('newlyQuiet', () => {
  test('an agent that crosses the threshold between two ticks is new once', () => {
    const before = [agent('a', 'working', LIMIT - MINUTE)]
    const after = [agent('a', 'working', LIMIT)]
    expect(newlyQuiet(new Set<string>(), before, NOW - MINUTE, LIMIT)).toEqual([])
    expect(ids(newlyQuiet(new Set<string>(), after, NOW, LIMIT))).toEqual(['a'])
    expect(newlyQuiet(new Set(['a']), after, NOW + MINUTE, LIMIT)).toEqual([])
  })

  test('an agent that leaves quiet and returns is new again', () => {
    const quiet = [agent('a', 'working', LIMIT)]
    const active = [agent('a', 'working', 0)]
    expect(newlyQuiet(new Set(['a']), active, NOW, LIMIT)).toEqual([])
    expect(ids(newlyQuiet(new Set<string>(), quiet, NOW, LIMIT))).toEqual(['a'])
  })

  test('an agent that stops working ends its episode', () => {
    expect(newlyQuiet(new Set(['a']), [agent('a', 'waiting', LIMIT)], NOW, LIMIT)).toEqual([])
  })
})

describe('quiet alert text', () => {
  test('uses the title and the minutes', () => {
    expect(quietAlertText(agent('a', 'working', 14 * MINUTE), NOW)).toEqual({ title: 'session a', body: 'เงียบไป 14 นาทีแล้ว' })
  })
})

describe('clock', () => {
  test('runs while the tab is visible or an alert is enabled', () => {
    expect(clockRuns(false, 'visible')).toBe(true)
    expect(clockRuns(true, 'hidden')).toBe(true)
    expect(clockRuns(false, 'hidden')).toBe(false)
  })
})
