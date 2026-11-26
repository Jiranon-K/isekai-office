import { describe, expect, test } from 'bun:test'
import type { AgentState, OfficeAgent } from '@shared/types'
import { alertText, canAlert, newlyWaiting, replyMode, storedEnabled, tabTitle } from './alert-logic'

function agent(id: string, state: AgentState, lastMessage: string | null = null): OfficeAgent {
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
    lastMessage,
    updatedAt: 0,
    activeAt: 0,
    terminal: null
  }
}

function ids(agents: OfficeAgent[]): string[] {
  return agents.map((found) => found.id)
}

describe('newly waiting agents', () => {
  test('an agent that goes from working to waiting is new', () => {
    expect(ids(newlyWaiting([agent('a', 'working')], [agent('a', 'waiting')]))).toEqual(['a'])
  })

  test('an agent that was already waiting is not new', () => {
    expect(newlyWaiting([agent('a', 'waiting')], [agent('a', 'blocked')])).toEqual([])
  })

  test('an agent that arrives already blocked is new', () => {
    expect(ids(newlyWaiting([agent('a', 'working')], [agent('a', 'working'), agent('b', 'blocked')]))).toEqual(['b'])
  })

  test('an agent that disappears is not new', () => {
    expect(newlyWaiting([agent('a', 'waiting')], [])).toEqual([])
  })

  test('the first snapshot is only a baseline', () => {
    expect(newlyWaiting(null, [agent('a', 'waiting')])).toEqual([])
  })
})

describe('alert text', () => {
  test('uses the title and the first non-empty line of the last message', () => {
    expect(alertText(agent('a', 'waiting', '\n\n  Allow Bash?  \nmore'))).toEqual({ title: 'session a', body: 'Allow Bash?' })
  })

  test('cuts the body at 120 characters', () => {
    expect(alertText(agent('a', 'waiting', 'x'.repeat(300))).body).toHaveLength(120)
  })

  test('falls back to the state when there is no message', () => {
    expect(alertText(agent('a', 'waiting')).body).toBe('รอคุณตัดสินใจ')
    expect(alertText(agent('a', 'blocked', '   ')).body).toBe('ติดอยู่ ต้องการคุณ')
  })
})

describe('tab title', () => {
  test('shows the count only when someone waits', () => {
    expect(tabTitle(0)).toBe('Isekai Office')
    expect(tabTitle(2)).toBe('(2) Isekai Office')
  })
})

describe('whether to alert', () => {
  test('only when switched on, permitted and the tab is hidden', () => {
    expect(canAlert(true, 'granted', 'hidden')).toBe(true)
    expect(canAlert(false, 'granted', 'hidden')).toBe(false)
    expect(canAlert(true, 'denied', 'hidden')).toBe(false)
    expect(canAlert(true, 'default', 'hidden')).toBe(false)
    expect(canAlert(true, 'granted', 'visible')).toBe(false)
  })

  test('the stored switch counts only while the browser still permits it', () => {
    expect(storedEnabled('1', 'granted')).toBe(true)
    expect(storedEnabled('1', 'denied')).toBe(false)
    expect(storedEnabled(null, 'granted')).toBe(false)
  })
})

describe('reply mode', () => {
  test('a waiting agent opens the quick reply until it is expanded', () => {
    expect(replyMode(agent('a', 'waiting'), false)).toBe('quick')
    expect(replyMode(agent('a', 'blocked'), false)).toBe('quick')
    expect(replyMode(agent('a', 'waiting'), true)).toBe('full')
  })

  test('an agent that does not wait opens the full panel', () => {
    expect(replyMode(agent('a', 'working'), false)).toBe('full')
    expect(replyMode(agent('a', 'done'), false)).toBe('full')
  })
})
