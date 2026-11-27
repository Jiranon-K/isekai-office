import { describe, expect, test } from 'bun:test'
import { reuseAgents } from './replay-stable'
import type { ReplayAgent } from './replay-logic'

function agent(overrides: Partial<ReplayAgent> = {}): ReplayAgent {
  return { agentId: 'a', title: 'one', repo: 'web', state: 'working', station: 'forge', ...overrides }
}

describe('reuseAgents', () => {
  test('keeps the previous array when every agent is unchanged', () => {
    const previous = [agent(), agent({ agentId: 'b' })]
    const next = [agent(), agent({ agentId: 'b' })]
    expect(reuseAgents(previous, next)).toBe(previous)
  })

  test('takes the new array when a state, a station or the count changed', () => {
    const previous = [agent()]
    expect(reuseAgents(previous, [agent({ state: 'waiting' })])).toEqual([agent({ state: 'waiting' })])
    expect(reuseAgents(previous, [agent({ station: 'archive' })])).toEqual([agent({ station: 'archive' })])
    expect(reuseAgents(previous, [agent(), agent({ agentId: 'b' })])).toHaveLength(2)
    expect(reuseAgents(previous, [])).toEqual([])
  })

  test('takes the new array when the order changed', () => {
    const previous = [agent(), agent({ agentId: 'b' })]
    const next = [agent({ agentId: 'b' }), agent()]
    expect(reuseAgents(previous, next)).toBe(next)
  })
})
