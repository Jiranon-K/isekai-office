import { describe, expect, test } from 'bun:test'
import type { AgentState, OfficeAgent } from '@shared/types'
import { longestWaiting } from './next-waiting-logic'

function agent(id: string, state: AgentState, updatedAt: number, stateSince: number): OfficeAgent {
  return { id, title: id, repo: null, workspace: null, worktree: null, session: null, contextTokens: null, state, tool: null, lastMessage: null, updatedAt, activeAt: updatedAt, terminal: null, stateSince }
}

describe('longestWaiting', () => {
  test('picks the waiting agent with the earliest state start time, not the earliest update', () => {
    const agents = [agent('recent', 'waiting', 1, 900), agent('oldest', 'waiting', 5, 100), agent('middle', 'blocked', 3, 500)]
    expect(longestWaiting(agents)?.id).toBe('oldest')
  })

  test('working and done agents are never picked', () => {
    expect(longestWaiting([agent('busy', 'working', 1, 1), agent('done', 'done', 1, 1)])).toBeNull()
  })

  test('with no waiting agent there is nothing to pick', () => {
    expect(longestWaiting([])).toBeNull()
  })

  test('a waiting agent without a usable start time falls back to the inbox order', () => {
    const agents = [agent('later', 'waiting', 9, Number.NaN), agent('first', 'waiting', 2, Number.NaN)]
    expect(longestWaiting(agents)?.id).toBe('first')
  })

  test('agents with a start time are preferred over agents without one', () => {
    const agents = [agent('undated', 'waiting', 1, Number.NaN), agent('dated', 'waiting', 9, 700)]
    expect(longestWaiting(agents)?.id).toBe('dated')
  })
})
