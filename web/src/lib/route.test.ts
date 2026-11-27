import { describe, expect, test } from 'bun:test'
import { HOTSPOTS } from '@/office/scene/hotspots'
import { closePanel, formatRoute, isPanelId, mergeQuery, openPanel, parseReplay, parseRoute, withReplay, selectAgent, togglePanel, type Route } from './route'

const EMPTY: Route = { open: null, agentId: null }

describe('parseRoute', () => {
  test('an empty query opens nothing', () => {
    expect(parseRoute('')).toEqual(EMPTY)
  })

  test('view=board still opens the quest board', () => {
    expect(parseRoute('?view=board')).toEqual({ open: 'questBoard', agentId: null })
  })

  test('agent still selects a session', () => {
    expect(parseRoute('?agent=abc')).toEqual({ open: null, agentId: 'abc' })
  })

  test('the board and an agent can be open together, as before', () => {
    expect(parseRoute('?view=board&agent=abc')).toEqual({ open: 'questBoard', agentId: 'abc' })
  })

  test('open names every other panel', () => {
    const panels: string[] = HOTSPOTS.filter((hotspot) => hotspot.action.kind === 'panel').map((hotspot) => hotspot.id)
    expect(panels.map((id) => String(parseRoute(`?open=${id}`).open))).toEqual(panels)
  })

  test('open=questBoard is the same as view=board', () => {
    expect(parseRoute('?open=questBoard')).toEqual(parseRoute('?view=board'))
  })

  test('an unknown hotspot and the windows open nothing', () => {
    expect(parseRoute('?open=cellar')).toEqual(EMPTY)
    expect(parseRoute('?open=windows')).toEqual(EMPTY)
  })

  test('an agent wins over a hotspot panel so only one panel is open', () => {
    expect(parseRoute('?open=hearth&agent=abc')).toEqual({ open: null, agentId: 'abc' })
  })

  test('an empty agent is no agent', () => {
    expect(parseRoute('?agent=')).toEqual(EMPTY)
  })
})

describe('formatRoute', () => {
  test('nothing open gives an empty query', () => {
    expect(formatRoute(EMPTY)).toBe('')
  })

  test('the quest board keeps its old address', () => {
    expect(formatRoute({ open: 'questBoard', agentId: null })).toBe('?view=board')
  })

  test('other panels use open', () => {
    expect(formatRoute({ open: 'door', agentId: null })).toBe('?open=door')
  })

  test('every route survives a round trip', () => {
    const routes: Route[] = [
      EMPTY,
      { open: 'questBoard', agentId: null },
      { open: 'questBoard', agentId: 'a b/c' },
      { open: 'orb', agentId: null },
      { open: null, agentId: 'abc' },
    ]
    expect(routes.map((route) => parseRoute(formatRoute(route)))).toEqual(routes)
  })
})

describe('route moves', () => {
  test('opening a panel closes the agent panel', () => {
    expect(togglePanel({ open: null, agentId: 'abc' }, 'reception')).toEqual({ open: 'reception', agentId: null })
  })

  test('opening another panel replaces the open one', () => {
    expect(togglePanel({ open: 'orb', agentId: null }, 'hearth')).toEqual({ open: 'hearth', agentId: null })
  })

  test('opening the open panel again closes it', () => {
    expect(togglePanel({ open: 'orb', agentId: null }, 'orb')).toEqual(EMPTY)
  })

  test('showing a panel that is already open keeps it open', () => {
    expect(openPanel({ open: 'questBoard', agentId: null }, 'questBoard')).toEqual({ open: 'questBoard', agentId: null })
  })

  test('showing a panel opens it and closes the agent panel', () => {
    expect(openPanel({ open: 'orb', agentId: 'abc' }, 'questBoard')).toEqual({ open: 'questBoard', agentId: null })
  })

  test('selecting an agent closes a hotspot panel', () => {
    expect(selectAgent({ open: 'reception', agentId: null }, 'abc')).toEqual({ open: null, agentId: 'abc' })
  })

  test('selecting an agent from the quest board keeps the board', () => {
    expect(selectAgent({ open: 'questBoard', agentId: null }, 'abc')).toEqual({ open: 'questBoard', agentId: 'abc' })
  })

  test('clearing the agent leaves the open panel alone', () => {
    expect(selectAgent({ open: 'questBoard', agentId: 'abc' }, null)).toEqual({ open: 'questBoard', agentId: null })
  })

  test('closing a panel keeps the agent', () => {
    expect(closePanel({ open: 'questBoard', agentId: 'abc' })).toEqual({ open: null, agentId: 'abc' })
  })
})

describe('isPanelId', () => {
  test('accepts panels and rejects the windows, unknown names and null', () => {
    expect(isPanelId('archive')).toBe(true)
    expect(isPanelId('windows')).toBe(false)
    expect(isPanelId('nope')).toBe(false)
    expect(isPanelId(null)).toBe(false)
  })
})

describe('mergeQuery', () => {
  test('keeps the board tab, filters and search while the board is open', () => {
    expect(mergeQuery('?view=board&tab=loop&space=OPS&q=web', { open: 'questBoard', agentId: 'abc' })).toBe('?view=board&agent=abc&tab=loop&space=OPS&q=web')
  })

  test('drops the board filters once the board is closed', () => {
    expect(mergeQuery('?view=board&tab=loop', { open: null, agentId: null })).toBe('')
  })

  test('drops keys it does not know', () => {
    expect(mergeQuery('?view=board&utm=x', { open: 'questBoard', agentId: null })).toBe('?view=board')
  })
})

describe('replay parameters', () => {
  test('reads the day and the moment', () => {
    expect(parseReplay('?replay=2026-11-27&at=1795000000000')).toEqual({ date: '2026-11-27', at: 1795000000000 })
  })

  test('reads a day without a moment', () => {
    expect(parseReplay('?replay=2026-11-27')).toEqual({ date: '2026-11-27', at: null })
  })

  test('is not a replay without a valid day', () => {
    expect(parseReplay('')).toBeNull()
    expect(parseReplay('?replay=yesterday&at=5')).toBeNull()
    expect(parseReplay('?at=5')).toBeNull()
  })

  test('ignores a moment that is not a whole number or is negative', () => {
    expect(parseReplay('?replay=2026-11-27&at=abc')?.at).toBeNull()
    expect(parseReplay('?replay=2026-11-27&at=-4')?.at).toBeNull()
    expect(parseReplay('?replay=2026-11-27&at=1.5')?.at).toBeNull()
  })

  test('mergeQuery keeps the replay across a route change', () => {
    expect(mergeQuery('?replay=2026-11-27&at=500&open=hearth', { open: 'hearth', agentId: null })).toBe('?open=hearth&replay=2026-11-27&at=500')
  })

  test('withReplay writes and clears the two keys and leaves the rest', () => {
    expect(withReplay('?open=hearth', { date: '2026-11-27', at: 1234.6 })).toBe('?open=hearth&replay=2026-11-27&at=1235')
    expect(withReplay('?open=hearth&replay=2026-11-27&at=5', null)).toBe('?open=hearth')
    expect(withReplay('?replay=2026-11-27&at=5', { date: '2026-11-26', at: null })).toBe('?replay=2026-11-26')
  })
})
