import { describe, expect, test } from 'bun:test'
import type { AgentState, OfficeAgent } from '@shared/types'
import { countAgents } from './agent-counts'

function agentWith(state: AgentState): OfficeAgent {
  return { id: state, title: state, repo: null, workspace: null, worktree: null, session: null, contextTokens: null, state, tool: null, lastMessage: null, updatedAt: 0, activeAt: 0, terminal: null, stateSince: 0 }
}

describe('countAgents', () => {
  const counts = countAgents([agentWith('working'), agentWith('working'), agentWith('waiting'), agentWith('blocked'), agentWith('done')])

  test('counts every session', () => {
    expect(counts.total).toBe(5)
  })

  test('counts only working sessions as working', () => {
    expect(counts.working).toBe(2)
  })

  test('adds waiting and blocked into needsYou', () => {
    expect(counts.needsYou).toBe(2)
  })
})
