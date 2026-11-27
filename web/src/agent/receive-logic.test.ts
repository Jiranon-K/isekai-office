import { describe, expect, test } from 'bun:test'
import type { AgentState, OfficeAgent } from '@shared/types'
import { canReceive } from './receive-logic'

function agent(state: AgentState, terminal: string | null): OfficeAgent {
  return {
    id: 'a',
    title: 'session a',
    repo: null,
    workspace: null,
    worktree: null,
    session: null,
    contextTokens: null,
    state,
    tool: null,
    lastMessage: null,
    updatedAt: 0,
    activeAt: 0,
    terminal
  }
}

describe('canReceive', () => {
  test('accepts an agent at the idle prompt that has a terminal', () => {
    expect(canReceive(agent('done', 'term'))).toBe(true)
  })

  test.each(['working', 'waiting', 'blocked'] as AgentState[])('refuses an agent that is %s', (state) => {
    expect(canReceive(agent(state, 'term'))).toBe(false)
  })

  test('refuses an agent without a terminal', () => {
    expect(canReceive(agent('done', null))).toBe(false)
  })
})
