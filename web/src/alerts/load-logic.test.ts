import { describe, expect, test } from 'bun:test'
import type { AgentState, OfficeAgent } from '@shared/types'
import { manaColor } from '@/office/scene/mana'
import { advanceLoad, canSendCompact, COMPACT_TEXT, highLoadIds, isOverLoad, loadAlertText, newlyHigh, rearm } from './load-logic'

const WINDOW = 1_000_000

function agent(id: string, percent: number | null, state: AgentState = 'done', terminal: string | null = `t-${id}`): OfficeAgent {
  return {
    id,
    title: `session ${id}`,
    repo: null,
    workspace: null,
    worktree: null,
    session: null,
    contextTokens: percent === null ? null : percent * 10_000,
    state,
    tool: null,
    lastMessage: null,
    updatedAt: 0,
    activeAt: 0,
    stateSince: 0,
    terminal
  }
}

function ids(agents: OfficeAgent[]): string[] {
  return agents.map((found) => found.id)
}

describe('isOverLoad', () => {
  test('is true from exactly 40 percent and not a point before', () => {
    expect(isOverLoad(agent('a', 39), WINDOW)).toBe(false)
    expect(isOverLoad(agent('a', 40), WINDOW)).toBe(true)
    expect(isOverLoad(agent('a', 41), WINDOW)).toBe(true)
  })

  test('is false when the load is unknown', () => {
    expect(isOverLoad(agent('a', null), WINDOW)).toBe(false)
  })

  test('is false when the context window is zero', () => {
    expect(isOverLoad(agent('a', 90), 0)).toBe(false)
  })
})

describe('highLoadIds', () => {
  test('holds only the agents at or over the line', () => {
    const agents = [agent('a', 10), agent('b', 40), agent('c', 90), agent('d', null)]
    expect([...highLoadIds(agents, WINDOW)]).toEqual(['b', 'c'])
  })
})

describe('newlyHigh', () => {
  test('returns an agent over the line that is not armed', () => {
    expect(ids(newlyHigh(new Set<string>(), [agent('a', 41)], WINDOW))).toEqual(['a'])
  })

  test('skips an armed agent and an agent under the line', () => {
    expect(newlyHigh(new Set(['a']), [agent('a', 41), agent('b', 39)], WINDOW)).toEqual([])
  })

  test('never returns an agent with an unknown load or a zero window', () => {
    expect(newlyHigh(new Set<string>(), [agent('a', null)], WINDOW)).toEqual([])
    expect(newlyHigh(new Set<string>(), [agent('a', 90)], 0)).toEqual([])
  })
})

describe('rearm', () => {
  test('drops an agent that falls under 30 percent', () => {
    expect([...rearm(new Set(['a']), [agent('a', 29)], WINDOW)]).toEqual([])
  })

  test('keeps an agent from 30 up to the line', () => {
    expect([...rearm(new Set(['a', 'b']), [agent('a', 30), agent('b', 39)], WINDOW)]).toEqual(['a', 'b'])
  })

  test('keeps an agent whose load is unknown or that left the list', () => {
    expect([...rearm(new Set(['a', 'b']), [agent('a', null)], WINDOW)]).toEqual(['a', 'b'])
  })

  test('does not change the set it is given', () => {
    const armed = new Set(['a'])
    rearm(armed, [agent('a', 5)], WINDOW)
    expect([...armed]).toEqual(['a'])
  })
})

function run(percents: number[]): string[] {
  let armed: ReadonlySet<string> = new Set<string>()
  const notified: string[] = []
  for (const percent of percents) {
    const step = advanceLoad(armed, [agent('a', percent)], WINDOW)
    armed = step.armed
    notified.push(...ids(step.fresh))
  }
  return notified
}

describe('advanceLoad', () => {
  test('35 to 41 percent notifies once', () => {
    expect(run([35, 41])).toEqual(['a'])
  })

  test('staying over the line does not notify again', () => {
    expect(run([35, 41, 50, 60, 41])).toEqual(['a'])
  })

  test('hovering between 39 and 41 several times notifies once', () => {
    expect(run([35, 41, 39, 41, 39, 41, 38, 40])).toEqual(['a'])
  })

  test('dropping under 30 and climbing past 40 again notifies again', () => {
    expect(run([35, 41, 29, 41])).toEqual(['a', 'a'])
  })

  test('a drop to exactly 30 does not rearm', () => {
    expect(run([41, 30, 41])).toEqual(['a'])
  })

  test('a load that reads unknown for one tick does not notify when it returns', () => {
    const unknown = advanceLoad(new Set(['a']), [agent('a', null)], WINDOW)
    expect(unknown.fresh).toEqual([])
    expect(advanceLoad(unknown.armed, [agent('a', 45)], WINDOW).fresh).toEqual([])
  })

  test('an agent with an unknown load never notifies', () => {
    expect(advanceLoad(new Set<string>(), [agent('a', null)], WINDOW).fresh).toEqual([])
  })

  test('a zero window never notifies', () => {
    expect(advanceLoad(new Set<string>(), [agent('a', 90)], 0).fresh).toEqual([])
  })

  test('arms every new agent over the line so the next tick is quiet', () => {
    const step = advanceLoad(new Set<string>(), [agent('a', 41), agent('b', 10)], WINDOW)
    expect(ids(step.fresh)).toEqual(['a'])
    expect([...step.armed]).toEqual(['a'])
    expect(advanceLoad(step.armed, [agent('a', 42), agent('b', 10)], WINDOW).fresh).toEqual([])
  })
})

describe('first snapshot', () => {
  test('arming with highLoadIds means an agent already over the line does not notify', () => {
    const agents = [agent('a', 70), agent('b', 20)]
    const armed = highLoadIds(agents, WINDOW)
    expect(advanceLoad(armed, agents, WINDOW).fresh).toEqual([])
    expect(ids(advanceLoad(armed, [agent('a', 70), agent('b', 41)], WINDOW).fresh)).toEqual(['b'])
  })
})

describe('loadAlertText', () => {
  test('uses the title and the rounded percent', () => {
    expect(loadAlertText(agent('a', 41), WINDOW)).toEqual({ title: 'session a', body: 'context ใช้ไป 41% แล้ว' })
  })

  test('rounds a fraction of a percent', () => {
    const fraction = { ...agent('a', 40), contextTokens: 404_900 }
    expect(loadAlertText(fraction, WINDOW).body).toBe('context ใช้ไป 40% แล้ว')
  })
})

describe('canSendCompact', () => {
  test('is true for a done agent with a terminal', () => {
    expect(canSendCompact(agent('a', 50, 'done', 'term'))).toBe(true)
  })

  test('is false while working, waiting or blocked', () => {
    for (const state of ['working', 'waiting', 'blocked'] as const) {
      expect(canSendCompact(agent('a', 50, state, 'term'))).toBe(false)
    }
  })

  test('is false without a terminal', () => {
    expect(canSendCompact(agent('a', 50, 'done', null))).toBe(false)
  })

  test('the text it sends is exactly /compact', () => {
    expect(COMPACT_TEXT).toBe('/compact')
  })
})

describe('mana bar colours', () => {
  test('still change at 70 and 85 percent, not at the alert line', () => {
    expect(manaColor(0.4)).toBe('mana-low')
    expect(manaColor(0.69)).toBe('mana-low')
    expect(manaColor(0.7)).toBe('mana-warn')
    expect(manaColor(0.85)).toBe('mana-high')
  })
})
