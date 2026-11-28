import { describe, expect, test } from 'bun:test'
import type { AgentState, SourceAgent } from '@shared/types'
import { readStateSince, stampStateSince, type StateSinceMemory } from './state-since'

function agentIn(id: string, state: AgentState): SourceAgent {
  return { id, title: `title ${id}`, repo: null, workspace: null, worktree: null, session: null, contextTokens: null, state, tool: null, lastMessage: null, updatedAt: 0, activeAt: 0, terminal: null }
}

describe('stampStateSince', () => {
  test('sets the current time for an agent seen for the first time', () => {
    const memory: StateSinceMemory = new Map()
    const [agent] = stampStateSince(memory, [agentIn('a', 'working')], 1_000)
    expect(agent?.stateSince).toBe(1_000)
  })

  test('keeps the time while the state is unchanged', () => {
    const memory: StateSinceMemory = new Map()
    stampStateSince(memory, [agentIn('a', 'waiting')], 1_000)
    const [agent] = stampStateSince(memory, [agentIn('a', 'waiting')], 5_000)
    expect(agent?.stateSince).toBe(1_000)
  })

  test('sets a new time when the state changes', () => {
    const memory: StateSinceMemory = new Map()
    stampStateSince(memory, [agentIn('a', 'working')], 1_000)
    const [agent] = stampStateSince(memory, [agentIn('a', 'waiting')], 5_000)
    expect(agent?.stateSince).toBe(5_000)
  })

  test('keeps the new time for the new state on the next unchanged poll', () => {
    const memory: StateSinceMemory = new Map()
    stampStateSince(memory, [agentIn('a', 'working')], 1_000)
    stampStateSince(memory, [agentIn('a', 'waiting')], 5_000)
    const [agent] = stampStateSince(memory, [agentIn('a', 'waiting')], 9_000)
    expect(agent?.stateSince).toBe(5_000)
  })

  test('tracks each agent separately', () => {
    const memory: StateSinceMemory = new Map()
    stampStateSince(memory, [agentIn('a', 'working'), agentIn('b', 'done')], 1_000)
    const agents = stampStateSince(memory, [agentIn('a', 'working'), agentIn('b', 'waiting')], 2_000)
    expect(agents.map((agent) => agent.stateSince)).toEqual([1_000, 2_000])
  })

  test('keeps the time of a session that stays when another session leaves', () => {
    const memory: StateSinceMemory = new Map()
    stampStateSince(memory, [agentIn('a', 'working'), agentIn('b', 'working')], 1_000)
    const [stays] = stampStateSince(memory, [agentIn('a', 'working')], 2_000)
    expect(stays?.stateSince).toBe(1_000)
  })

  test('removes a session that left the list', () => {
    const memory: StateSinceMemory = new Map()
    stampStateSince(memory, [agentIn('a', 'working'), agentIn('b', 'working')], 1_000)
    stampStateSince(memory, [agentIn('a', 'working')], 2_000)
    expect(memory.has('b')).toBe(false)
    expect(memory.has('a')).toBe(true)
  })

  test('a session that returns after leaving starts a new time', () => {
    const memory: StateSinceMemory = new Map()
    stampStateSince(memory, [agentIn('a', 'working'), agentIn('b', 'working')], 1_000)
    stampStateSince(memory, [agentIn('a', 'working')], 2_000)
    const [, returning] = stampStateSince(memory, [agentIn('a', 'working'), agentIn('b', 'working')], 3_000)
    expect(returning?.stateSince).toBe(3_000)
  })

  test('keeps every agent field and adds only stateSince', () => {
    const memory: StateSinceMemory = new Map()
    const source = agentIn('a', 'done')
    const [agent] = stampStateSince(memory, [source], 7)
    expect(agent).toEqual({ ...source, stateSince: 7 })
  })
})

describe('readStateSince', () => {
  test('a failed read keeps every entry', async () => {
    const memory: StateSinceMemory = new Map()
    stampStateSince(memory, [agentIn('a', 'working'), agentIn('b', 'waiting')], 1_000)
    await expect(readStateSince(memory, () => Promise.reject(new Error('source down')))).rejects.toThrow('source down')
    expect(memory.get('a')?.since).toBe(1_000)
    expect(memory.get('b')?.since).toBe(1_000)
  })

  test('takes the time after the read has finished', async () => {
    const memory: StateSinceMemory = new Map()
    const startedAt = Date.now()
    const [agent] = await readStateSince(memory, async () => {
      await Bun.sleep(20)
      return [agentIn('a', 'working')]
    })
    expect(agent?.stateSince).toBeGreaterThanOrEqual(startedAt + 10)
  })
})
