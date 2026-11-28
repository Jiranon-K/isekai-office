import { describe, expect, test } from 'bun:test'
import type { AgentState, OfficeAgent, QuestCard } from '@shared/types'
import type { BoardItem, WaitReason } from './monitor-logic'
import { boardQueryParams, filteredItems, inboxGroups, loopLanes, matchesSearch, nextStep, parseBoardQuery, spaceTone } from './view-logic'

function cardWith(overrides: Partial<QuestCard> = {}): QuestCard {
  return {
    id: '1',
    key: 'OPS-1',
    title: 'Fix the webhook',
    space: 'OPS',
    status: '',
    column: 'doing',
    priority: null,
    assignee: null,
    sprint: null,
    epic: null,
    labels: [],
    route: 'agent',
    updatedAt: '2026-11-01',
    url: 'https://workspace.test/tasks/OPS-1',
    loop: null,
    mergeRequest: null,
    ...overrides
  }
}

function agentWith(state: AgentState): OfficeAgent {
  return { id: 'agent-1', title: 'OPS-1', repo: null, workspace: null, worktree: null, session: null, contextTokens: null, state, tool: null, lastMessage: null, updatedAt: 0, activeAt: 0, terminal: null, stateSince: 0 }
}

function itemWith(reason: WaitReason | null, card: QuestCard = cardWith(), agent: OfficeAgent | null = null): BoardItem {
  return { card, agent, reason }
}

function loopCard(status: string, mr: string | null = null): QuestCard {
  return cardWith({ id: status, loop: { status, mr, worktree: null, session: null } })
}

describe('board query', () => {
  test('an empty query opens the inbox on running sprints', () => {
    expect(parseBoardQuery('')).toEqual({ tab: 'inbox', filter: { space: null, sprint: { kind: 'running' } }, search: '' })
  })

  test('reads the tab, product, sprint and search', () => {
    expect(parseBoardQuery('?tab=loop&space=OPS&sprint=all&q=web')).toEqual({ tab: 'loop', filter: { space: 'OPS', sprint: { kind: 'all' } }, search: 'web' })
  })

  test('an unknown tab falls back to the inbox', () => {
    expect(parseBoardQuery('?tab=nope').tab).toBe('inbox')
  })

  test('defaults leave the address clean', () => {
    expect(boardQueryParams(parseBoardQuery(''))).toEqual({})
  })

  test('a query survives a round trip', () => {
    const query = parseBoardQuery('?tab=release&space=APP&sprint=named:6.45.0&q=fb')
    expect(parseBoardQuery(`?${new URLSearchParams(boardQueryParams(query))}`)).toEqual(query)
  })
})

describe('search', () => {
  test('matches the key without caring about case', () => {
    expect(matchesSearch(cardWith(), 'ops-1')).toBe(true)
  })

  test('matches part of the title', () => {
    expect(matchesSearch(cardWith(), 'webhook')).toBe(true)
  })

  test('an empty search matches everything', () => {
    expect(matchesSearch(cardWith(), '  ')).toBe(true)
  })

  test('rejects a card that has neither', () => {
    expect(matchesSearch(cardWith(), 'billing')).toBe(false)
  })
})

describe('inbox groups', () => {
  test('follow the order the owner works through and skip empty reasons', () => {
    const groups = inboxGroups([itemWith('my_task'), itemWith('verify_mr'), itemWith('agent_asks')])
    expect(groups.map((group) => group.reason)).toEqual(['agent_asks', 'verify_mr', 'my_task'])
  })

  test('are empty when nothing waits', () => {
    expect(inboxGroups([])).toEqual([])
  })
})

describe('loop lanes', () => {
  test('run from design to merged and leave out cards outside the Loop', () => {
    const lanes = loopLanes([itemWith(null, loopCard('merged')), itemWith(null, cardWith()), itemWith(null, loopCard('designing'))])
    expect(lanes.filter((lane) => lane.items.length > 0).map((lane) => lane.stage)).toEqual(['designing', 'merged'])
  })

  test('keep a stage the board does not know yet', () => {
    expect(loopLanes([itemWith(null, loopCard('paused'))]).at(-1)?.stage).toBe('paused')
  })
})

describe('next step', () => {
  test('a session that asks opens that session', () => {
    expect(nextStep(itemWith('agent_asks', cardWith(), agentWith('waiting')))).toEqual({ label: 'ตอบ session', agentId: 'agent-1', href: null })
  })

  test('an MR that waits for a verify opens the MR', () => {
    expect(nextStep(itemWith('verify_mr', loopCard('mr_open', 'https://gitlab.test/mr/1'))).href).toBe('https://gitlab.test/mr/1')
  })

  test('a design to review opens the card', () => {
    expect(nextStep(itemWith('design_review')).label).toBe('ตรวจ design')
  })

  test('anything else opens the card in Workspace', () => {
    expect(nextStep(itemWith(null))).toEqual({ label: 'เปิดใน Workspace', agentId: null, href: 'https://workspace.test/tasks/OPS-1' })
  })
})

describe('filtered items', () => {
  test('keep only the chosen product', () => {
    const snapshot = { cards: [cardWith(), cardWith({ id: '2', space: 'APP' })], sprints: [], error: null, at: 1 }
    expect(filteredItems(snapshot, [], { space: 'APP', sprint: { kind: 'all' } }).map((item) => item.card.id)).toEqual(['2'])
  })
})

describe('space tone', () => {
  test('a space always gets the same badge colour', () => {
    expect(spaceTone('APP')).toBe(spaceTone('APP'))
  })

  test('two spaces with different letter sums can be told apart', () => {
    expect(spaceTone('APP')).not.toBe(spaceTone('OPS'))
  })
})
