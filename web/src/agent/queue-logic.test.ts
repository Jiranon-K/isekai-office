import { describe, expect, test } from 'bun:test'
import type { AgentState, Choice, OfficeAgent } from '@shared/types'
import {
  afterAnswer,
  afterSkip,
  answerLockHeld,
  canAct,
  currentOf,
  forgetGone,
  isQueueOpenKey,
  keyFor,
  loadedScreen,
  nextOf,
  prefetchedScreen,
  queueOrder,
  restartGuard,
  settle,
  startQueue,
  type QueueKeyEvent,
  type QueueState
} from './queue-logic'

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
    activeAt: updatedAt,
    terminal: 'term'
  }
}

function ids(agents: OfficeAgent[]): string[] {
  return agents.map((found) => found.id)
}

function state(currentId: string | null, skipped: string[] = [], shownAt = 0): QueueState {
  return { skipped: new Set(skipped), currentId, shownAt }
}

function press(key: string, modifiers: Partial<QueueKeyEvent> = {}): QueueKeyEvent {
  return { key, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, ...modifiers }
}

const THREE = [agent('c', 'waiting', 300), agent('a', 'waiting', 100), agent('b', 'blocked', 200), agent('w', 'working', 50)]
const NUMBERED: Choice[] = [
  { number: 1, label: 'Yes', selected: true },
  { number: 2, label: 'No', selected: false }
]

describe('queue order', () => {
  test('lists waiting agents by longest wait', () => {
    expect(ids(queueOrder(THREE, new Set()))).toEqual(['a', 'b', 'c'])
  })

  test('leaves out skipped agents', () => {
    expect(ids(queueOrder(THREE, new Set(['a'])))).toEqual(['b', 'c'])
  })

  test('startQueue begins with the longest wait', () => {
    expect(startQueue(THREE, 9)).toEqual({ skipped: new Set(), currentId: 'a', shownAt: 9 })
  })

  test('startQueue has no current agent when nobody waits', () => {
    expect(startQueue([agent('w', 'working', 1)], 9).currentId).toBeNull()
  })

  test('nextOf is the agent after the current one', () => {
    expect(nextOf(state('a'), THREE)?.id).toBe('b')
    expect(nextOf(state('a', ['b']), THREE)?.id).toBe('c')
    expect(nextOf(state('a'), [agent('a', 'waiting', 1)])).toBeNull()
  })
})

describe('current agent', () => {
  test('stays current while it waits, even when an older wait appears', () => {
    const agents = [...THREE, agent('older', 'waiting', 10)]
    expect(currentOf(state('b'), agents)?.id).toBe('b')
  })

  test('falls back to the longest wait when the current agent left', () => {
    expect(currentOf(state('gone'), THREE)?.id).toBe('a')
  })

  test('is null when nobody waits', () => {
    expect(currentOf(state(null), [agent('w', 'working', 1)])).toBeNull()
  })

  test('settle keeps the same state and the same shownAt when nothing changed', () => {
    const before = state('a', [], 5)
    expect(settle(before, THREE, 99)).toBe(before)
  })

  test('settle moves to the next agent with a new shownAt when the current one left', () => {
    const settled = settle(state('a', [], 5), THREE.filter((found) => found.id !== 'a'), 99)
    expect(settled).toEqual({ skipped: new Set(), currentId: 'b', shownAt: 99 })
  })

  test('settle ends with no current agent when nobody waits', () => {
    expect(settle(state('a', [], 5), [], 99).currentId).toBeNull()
  })

  test('settle starts a new round when only skipped agents wait', () => {
    const settled = settle(state('a', ['b', 'c'], 5), [agent('b', 'waiting', 2), agent('c', 'waiting', 3)], 99)
    expect(settled).toEqual({ skipped: new Set(), currentId: 'b', shownAt: 99 })
  })
})

describe('answer and skip', () => {
  test('three answers visit three different agents in order of wait', () => {
    const first = startQueue(THREE, 0)
    const second = afterAnswer(first, THREE, 1000)
    const third = afterAnswer(second, THREE, 2000)
    expect([first.currentId, second.currentId, third.currentId]).toEqual(['a', 'b', 'c'])
  })

  test('skip moves on with a new shownAt', () => {
    expect(afterSkip(state('a'), THREE, 50)).toEqual({ skipped: new Set(['a']), currentId: 'b', shownAt: 50 })
  })

  test('a skipped agent returns at the end of the round', () => {
    const afterFirst = afterSkip(state('a'), THREE, 1)
    const afterSecond = afterAnswer(afterFirst, THREE, 2)
    const afterThird = afterAnswer(afterSecond, THREE, 3)
    expect([afterFirst.currentId, afterSecond.currentId, afterThird.currentId]).toEqual(['b', 'c', 'a'])
    expect(afterThird.skipped.size).toBe(0)
  })

  test('answering the last fresh agent goes back to a skipped one before itself', () => {
    const agents = [agent('a', 'waiting', 1), agent('b', 'waiting', 2)]
    expect(afterAnswer(state('b', ['a']), agents, 5).currentId).toBe('a')
  })

  test('afterAnswer without a current agent settles', () => {
    expect(afterAnswer(state(null), THREE, 7).currentId).toBe('a')
  })

  test('a new agent starting to wait is shown after the current one, not in front', () => {
    const agents = [...THREE, agent('late', 'waiting', 999)]
    expect(currentOf(state('a'), agents)?.id).toBe('a')
    expect(afterAnswer(state('a'), agents, 1).currentId).toBe('b')
  })

  test('a new agent that sorts before the current one does not replace it', () => {
    const agents = [...THREE, agent('early', 'waiting', 1)]
    expect(currentOf(state('b'), agents)?.id).toBe('b')
    expect(settle(state('b', [], 5), agents, 99)).toEqual(state('b', [], 5))
  })
})

describe('forgetting skipped agents', () => {
  test('drops ids that no longer wait', () => {
    const agents = [agent('a', 'working', 1), agent('b', 'waiting', 2)]
    expect([...forgetGone(new Set(['a', 'b']), agents)]).toEqual(['b'])
  })

  test('returns the same set when nothing is dropped', () => {
    const skipped = new Set(['b'])
    expect(forgetGone(skipped, [agent('b', 'waiting', 2)])).toBe(skipped)
  })

  test('an agent that was skipped, left, and asks again is back in the queue', () => {
    const whileGone = forgetGone(new Set(['a']), [agent('a', 'working', 1)])
    const askedAgain = [agent('a', 'waiting', 500), agent('b', 'waiting', 600)]
    expect(ids(queueOrder(askedAgain, whileGone))).toEqual(['a', 'b'])
  })

  test('settle forgets skipped agents that left', () => {
    const agents = [agent('a', 'working', 1), agent('b', 'waiting', 2)]
    expect(settle(state('b', ['a'], 5), agents, 9).skipped.size).toBe(0)
  })
})

describe('keys', () => {
  test('digits choose when the choice exists', () => {
    expect(keyFor(press('2'), NUMBERED)).toEqual({ kind: 'choose', choice: 2 })
    expect(keyFor(press('3'), NUMBERED)).toBeNull()
  })

  test('1 is allow when there is no numbered list', () => {
    expect(keyFor(press('1'), [])).toEqual({ kind: 'choose', choice: 1 })
    expect(keyFor(press('2'), [])).toBeNull()
  })

  test('letters map to deny, skip and expand', () => {
    expect(keyFor(press('x'), [])).toEqual({ kind: 'deny' })
    expect(keyFor(press('s'), NUMBERED)).toEqual({ kind: 'skip' })
    expect(keyFor(press('o'), NUMBERED)).toEqual({ kind: 'expand' })
  })

  test('Escape closes', () => {
    expect(keyFor(press('Escape'), [])).toEqual({ kind: 'close' })
  })

  test('modifiers and composition give nothing', () => {
    expect(keyFor(press('1', { ctrlKey: true }), [])).toBeNull()
    expect(keyFor(press('s', { metaKey: true }), [])).toBeNull()
    expect(keyFor(press('x', { altKey: true }), [])).toBeNull()
    expect(keyFor(press('1', { isComposing: true }), [])).toBeNull()
  })

  test('other keys give nothing', () => {
    expect(keyFor(press('q'), NUMBERED)).toBeNull()
    expect(keyFor(press('Enter'), NUMBERED)).toBeNull()
  })
})

describe('canAct', () => {
  test('is false before the screen has loaded', () => {
    expect(canAct(state('a', [], 0), 10_000, false)).toBe(false)
  })

  test('is false for 400 ms after the card changed', () => {
    expect(canAct(state('a', [], 1000), 1100, true)).toBe(false)
    expect(canAct(state('a', [], 1000), 1399, true)).toBe(false)
  })

  test('is true once 400 ms have passed with the screen loaded', () => {
    expect(canAct(state('a', [], 1000), 1400, true)).toBe(true)
  })

  test('is false with no current agent', () => {
    expect(canAct(state(null, [], 0), 10_000, true)).toBe(false)
  })

  test('two presses 100 ms apart answer one agent only', () => {
    const shown = startQueue(THREE, 0)
    const firstAllowed = canAct(shown, 500, true)
    const moved = afterAnswer(shown, THREE, 500)
    const secondAllowed = canAct(moved, 600, true)
    expect([firstAllowed, secondAllowed]).toEqual([true, false])
  })
})

describe('open key', () => {
  test('opens from the room', () => {
    expect(isQueueOpenKey(press('a'), false, false)).toBe(true)
  })

  test('does nothing while typing or with the board open', () => {
    expect(isQueueOpenKey(press('a'), true, false)).toBe(false)
    expect(isQueueOpenKey(press('a'), false, true)).toBe(false)
  })

  test('does nothing with a modifier held or while composing', () => {
    expect(isQueueOpenKey(press('a', { ctrlKey: true }), false, false)).toBe(false)
    expect(isQueueOpenKey(press('a', { metaKey: true }), false, false)).toBe(false)
    expect(isQueueOpenKey(press('a', { altKey: true }), false, false)).toBe(false)
    expect(isQueueOpenKey(press('a', { isComposing: true }), false, false)).toBe(false)
  })

  test('ignores other keys', () => {
    expect(isQueueOpenKey(press('b'), false, false)).toBe(false)
  })
})

describe('loaded screen', () => {
  test('is used only when it was fetched for the current agent update', () => {
    expect(loadedScreen('P1', 100, 100)).toBe('P1')
    expect(loadedScreen('P1', 100, 200)).toBeNull()
    expect(loadedScreen('P1', null, 200)).toBeNull()
    expect(loadedScreen(null, 200, 200)).toBeNull()
  })

  test('a prompt that changed under the card cannot be answered', () => {
    const shown = state('a', [], 0)
    const stale = loadedScreen('P1', 100, 200)
    expect(canAct(shown, 10_000, stale !== null)).toBe(false)
  })

  test('a new screen restarts the 400 ms guard', () => {
    const shown = state('a', [], 0)
    expect(canAct(restartGuard(shown, 5000), 5100, true)).toBe(false)
    expect(canAct(restartGuard(shown, 5000), 5400, true)).toBe(true)
    expect(restartGuard(shown, -1)).toBe(shown)
  })
})

describe('prefetched screen', () => {
  const prefetched = { agentId: 'b', updatedAt: 100, detail: 'P1' }

  test('is used when it is for the same agent and the same update', () => {
    expect(prefetchedScreen(prefetched, 'b', 100)).toBe('P1')
  })

  test('is dropped when the agent prompt changed before it became current', () => {
    expect(prefetchedScreen(prefetched, 'b', 200)).toBeNull()
  })

  test('is dropped for another agent or when nothing was prefetched', () => {
    expect(prefetchedScreen(prefetched, 'c', 100)).toBeNull()
    expect(prefetchedScreen(null, 'b', 100)).toBeNull()
  })
})

describe('answer lock', () => {
  test('is free when nothing was answered', () => {
    expect(answerLockHeld(null, 100, true)).toBe(false)
  })

  test('holds while the agent has not moved on', () => {
    expect(answerLockHeld(100, 100, true)).toBe(true)
  })

  test('holds after the agent moved on until the fresh screen has loaded', () => {
    expect(answerLockHeld(100, 200, false)).toBe(true)
  })

  test('frees for a still-waiting agent once its new screen has loaded', () => {
    expect(answerLockHeld(100, 200, true)).toBe(false)
  })
})
