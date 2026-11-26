import { describe, expect, test } from 'bun:test'
import type { AgentState, OfficeAgent } from '@shared/types'
import { isJumpKey, nextWaiting, waitingQueue, type JumpKeyEvent } from './jump-logic'

function agent(id: string, state: AgentState, updatedAt: number): OfficeAgent {
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
    updatedAt,
    terminal: null
  }
}

function ids(agents: OfficeAgent[]): string[] {
  return agents.map((found) => found.id)
}

const THREE_WAITING = [agent('c', 'waiting', 300), agent('a', 'blocked', 100), agent('b', 'waiting', 200), agent('w', 'working', 50)]

describe('waiting queue', () => {
  test('lists waiting and blocked agents, longest wait first', () => {
    expect(ids(waitingQueue(THREE_WAITING))).toEqual(['a', 'b', 'c'])
  })

  test('agents that are working or done are left out', () => {
    expect(ids(waitingQueue([agent('w', 'working', 1), agent('d', 'done', 2)]))).toEqual([])
  })

  test('equal updatedAt falls back to id order', () => {
    const tied = [agent('z', 'waiting', 5), agent('m', 'waiting', 5), agent('a', 'waiting', 5)]
    expect(ids(waitingQueue(tied))).toEqual(['a', 'm', 'z'])
  })

  test('does not reorder the input', () => {
    const input = [...THREE_WAITING]
    waitingQueue(input)
    expect(ids(input)).toEqual(ids(THREE_WAITING))
  })
})

describe('next waiting agent', () => {
  test('three presses visit each once and the fourth wraps to the first', () => {
    const visited: Array<string | null> = []
    let current: string | null = null
    for (let press = 0; press < 4; press += 1) {
      current = nextWaiting(THREE_WAITING, current)
      visited.push(current)
    }
    expect(visited).toEqual(['a', 'b', 'c', 'a'])
  })

  test('a current id that is not waiting jumps to the first', () => {
    expect(nextWaiting(THREE_WAITING, 'w')).toBe('a')
  })

  test('an unknown current id jumps to the first', () => {
    expect(nextWaiting(THREE_WAITING, 'missing')).toBe('a')
  })

  test('nobody waiting returns null', () => {
    expect(nextWaiting([agent('w', 'working', 1)], 'w')).toBeNull()
  })

  test('an empty list returns null', () => {
    expect(nextWaiting([], null)).toBeNull()
  })

  test('a single waiting agent stays on itself', () => {
    expect(nextWaiting([agent('a', 'waiting', 1)], 'a')).toBe('a')
  })
})

const PLAIN: JumpKeyEvent = { key: 'n', ctrlKey: false, metaKey: false, altKey: false, isComposing: false }

describe('jump key', () => {
  test('a plain n jumps', () => {
    expect(isJumpKey(PLAIN, false, false)).toBe(true)
  })

  test('other keys do not jump', () => {
    expect(isJumpKey({ ...PLAIN, key: 'm' }, false, false)).toBe(false)
    expect(isJumpKey({ ...PLAIN, key: 'N' }, false, false)).toBe(false)
  })

  test('typing in a field does not jump', () => {
    expect(isJumpKey(PLAIN, true, false)).toBe(false)
  })

  test('Ctrl, Meta or Alt held does not jump', () => {
    expect(isJumpKey({ ...PLAIN, ctrlKey: true }, false, false)).toBe(false)
    expect(isJumpKey({ ...PLAIN, metaKey: true }, false, false)).toBe(false)
    expect(isJumpKey({ ...PLAIN, altKey: true }, false, false)).toBe(false)
  })

  test('an IME composition does not jump', () => {
    expect(isJumpKey({ ...PLAIN, isComposing: true }, false, false)).toBe(false)
  })

  test('the open quest board does not jump', () => {
    expect(isJumpKey(PLAIN, false, true)).toBe(false)
  })
})
