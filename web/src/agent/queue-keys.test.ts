import { describe, expect, test } from 'bun:test'
import type { AgentState, Choice, OfficeAgent } from '@shared/types'
import {
  afterAnswer,
  afterAnswerFor,
  answerLockHeld,
  canAct,
  canAnswer,
  canWriteTo,
  isQueueOpenKey,
  keyAnswers,
  keyFor,
  loadedScreen,
  prefetchedScreen,
  queueKeyFor,
  restartGuard,
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
    stateSince: 0,
    terminal: 'term'
  }
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

describe('canWriteTo', () => {
  test('needs a terminal and a source that accepts commands', () => {
    expect(canWriteTo('term', true)).toBe(true)
    expect(canWriteTo(null, true)).toBe(false)
    expect(canWriteTo('term', false)).toBe(false)
  })
})

describe('queueKeyFor', () => {
  test('gives the same keys as keyFor while the board is closed', () => {
    expect(queueKeyFor(press('1'), NUMBERED, false)).toEqual({ kind: 'choose', choice: 1 })
    expect(queueKeyFor(press('Escape'), NUMBERED, false)).toEqual({ kind: 'close' })
  })

  test('gives nothing while the quest board is open over the card', () => {
    for (const key of ['1', 'x', 's', 'o', 'Escape']) {
      expect(queueKeyFor(press(key), NUMBERED, true)).toBeNull()
    }
  })
})

describe('canAnswer', () => {
  test('a typed prompt waits for the loaded screen and the guard like a key', () => {
    expect(canAnswer(state('a', [], 0), 10_000, false, false)).toBe(false)
    expect(canAnswer(state('a', [], 1000), 1100, true, false)).toBe(false)
    expect(canAnswer(state('a', [], 1000), 1400, true, false)).toBe(true)
  })

  test('is false while the decision is locked', () => {
    expect(canAnswer(state('a', [], 0), 10_000, true, true)).toBe(false)
  })
})

describe('keyAnswers', () => {
  test('only choose and deny answer a prompt', () => {
    expect(keyAnswers({ kind: 'choose', choice: 1 })).toBe(true)
    expect(keyAnswers({ kind: 'deny' })).toBe(true)
  })

  test('skip, expand and close never wait for the screen', () => {
    expect(keyAnswers({ kind: 'skip' })).toBe(false)
    expect(keyAnswers({ kind: 'expand' })).toBe(false)
    expect(keyAnswers({ kind: 'close' })).toBe(false)
  })
})

describe('afterAnswerFor', () => {
  test('moves on when the answered agent is the current one', () => {
    const shown = startQueue(THREE, 0)
    expect(afterAnswerFor(shown, THREE, 500, 'a').currentId).toBe('b')
  })

  test('ignores an answer for an agent that is no longer current', () => {
    const shown = startQueue(THREE, 0)
    expect(afterAnswerFor(shown, THREE, 500, 'b')).toBe(shown)
  })
})
