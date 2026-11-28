import { describe, expect, test } from 'bun:test'
import type { BoardSnapshot, OfficeAgent, QuestCard, Sprint } from '@shared/types'
import { agentForCard, boardView, DEFAULT_FILTER, filterOptions, matchesFilter, sprintChoiceFromValue, sprintChoiceValue, waitReason } from './monitor-logic'

function cardWith(overrides: Partial<QuestCard>): QuestCard {
  return {
    id: 'id', key: 'OPS-1', title: 'title', space: 'OPS', status: 'x', column: 'doing', priority: null,
    assignee: null, sprint: '2026-W48', epic: null, labels: [], route: null, updatedAt: '2026-11-24', url: '',
    loop: null, mergeRequest: null, ...overrides
  }
}

function inLoop(status: string, overrides: Partial<QuestCard> = {}, loop: Partial<NonNullable<QuestCard['loop']>> = {}): QuestCard {
  return cardWith({ loop: { status, mr: null, worktree: null, session: null, ...loop }, ...overrides })
}

function agentWith(overrides: Partial<OfficeAgent>): OfficeAgent {
  return {
    id: 'a1', title: 'work', repo: null, workspace: null, worktree: null, session: null, contextTokens: null,
    state: 'working', tool: null, lastMessage: null, updatedAt: 1, activeAt: 1, terminal: null, ...overrides, stateSince: 0
  }
}

const RUNNING: Sprint = { space: 'OPS', name: '2026-W48', state: 'running', endDate: '2026-11-29', goal: null }
const PLANNED: Sprint = { space: 'OPS', name: '2026-W49', state: 'planned', endDate: null, goal: null }

describe('waitReason', () => {
  test('a finished card never waits', () => {
    expect(waitReason(inLoop('blocked', { column: 'done' }), null)).toBeNull()
  })

  test('an agent that asks beats the loop status', () => {
    expect(waitReason(inLoop('blocked'), agentWith({ state: 'waiting' }))).toBe('agent_asks')
    expect(waitReason(inLoop('working'), agentWith({ state: 'blocked' }))).toBe('agent_asks')
  })

  test('loop statuses map to their reasons', () => {
    expect(waitReason(inLoop('blocked'), null)).toBe('blocked')
    expect(waitReason(inLoop('design_ready'), null)).toBe('design_review')
    expect(waitReason(inLoop('mr_open'), null)).toBe('verify_mr')
  })

  test('statuses that need nothing from the owner do not wait', () => {
    for (const status of ['designing', 'queued', 'working', 'merged']) {
      expect(waitReason(inLoop(status), null)).toBeNull()
    }
  })

  test('a human card waits only once it is doing or in review', () => {
    expect(waitReason(cardWith({ route: 'human', column: 'doing' }), null)).toBe('my_task')
    expect(waitReason(cardWith({ route: 'human', column: 'review' }), null)).toBe('my_task')
    expect(waitReason(cardWith({ route: 'human', column: 'todo' }), null)).toBeNull()
  })

  test('untriaged and agent-routed cards outside the Loop do not wait', () => {
    expect(waitReason(cardWith({ route: null }), null)).toBeNull()
    expect(waitReason(cardWith({ route: 'agent' }), null)).toBeNull()
  })
})

describe('agentForCard', () => {
  test('the recorded session id wins over worktree and title', () => {
    const card = inLoop('working', {}, { session: 's-1', worktree: '/wt' })
    const exact = agentWith({ id: 'exact', session: 's-1' })
    const others = [agentWith({ id: 'tree', worktree: '/wt' }), agentWith({ id: 'title', title: 'OPS-1 fix' })]
    expect(agentForCard(card, [...others, exact])?.id).toBe('exact')
  })

  test('the worktree matches when there is no session, newest agent first', () => {
    const card = inLoop('working', {}, { worktree: '/wt' })
    const agents = [agentWith({ id: 'old', worktree: '/wt', updatedAt: 1 }), agentWith({ id: 'new', worktree: '/wt', updatedAt: 9 })]
    expect(agentForCard(card, agents)?.id).toBe('new')
  })

  test('the title matches the key as a whole word', () => {
    const agents = [agentWith({ id: 'near', title: 'OPS-12 other' }), agentWith({ id: 'hit', title: 'design OPS-1 webhooks' })]
    expect(agentForCard(cardWith({ key: 'OPS-1' }), agents)?.id).toBe('hit')
  })

  test('no signal means no agent', () => {
    expect(agentForCard(cardWith({ key: 'OPS-1' }), [agentWith({ title: 'something else' })])).toBeNull()
    expect(agentForCard(cardWith({ key: null }), [agentWith({ title: 'null' })])).toBeNull()
  })
})

describe('matchesFilter', () => {
  const sprints = [RUNNING, PLANNED]

  test('the default filter keeps cards of the running sprint only', () => {
    expect(matchesFilter(cardWith({ sprint: '2026-W48' }), sprints, DEFAULT_FILTER)).toBe(true)
    expect(matchesFilter(cardWith({ sprint: '2026-W49' }), sprints, DEFAULT_FILTER)).toBe(false)
    expect(matchesFilter(cardWith({ sprint: null }), sprints, DEFAULT_FILTER)).toBe(false)
  })

  test('a space with no running sprint shows all its cards', () => {
    expect(matchesFilter(cardWith({ space: 'APP', sprint: null }), sprints, DEFAULT_FILTER)).toBe(true)
  })

  test('all, named and space choices', () => {
    expect(matchesFilter(cardWith({ sprint: null }), sprints, { space: null, sprint: { kind: 'all' } })).toBe(true)
    expect(matchesFilter(cardWith({ sprint: '2026-W49' }), sprints, { space: null, sprint: { kind: 'named', name: '2026-W49' } })).toBe(true)
    expect(matchesFilter(cardWith({ space: 'OPS' }), sprints, { space: 'APP', sprint: { kind: 'all' } })).toBe(false)
  })
})

describe('boardView', () => {
  const snapshot: BoardSnapshot = {
    cards: [
      inLoop('design_ready', { id: 'lane', key: 'OPS-1', sprint: '2026-W49' }),
      inLoop('working', { id: 'col', key: 'OPS-2' }),
      cardWith({ id: 'ask', key: 'OPS-3', column: 'todo' }),
      cardWith({ id: 'other', key: 'APP-1', space: 'APP', route: 'human', column: 'doing', sprint: null })
    ],
    sprints: [RUNNING],
    error: null,
    at: 0
  }
  const agents = [agentWith({ title: 'OPS-3 question', state: 'waiting' })]
  const view = boardView(snapshot, agents, DEFAULT_FILTER, new Date(2026, 10, 24))

  test('the lane ignores the sprint filter and sorts by reason', () => {
    expect(view.waiting.map((item) => item.card.id)).toEqual(['ask', 'lane', 'other'])
  })

  test('a card in the lane is not repeated in the columns', () => {
    const ids = Object.values(view.columns).flatMap((items) => items.map((item) => item.card.id))
    expect(ids).toEqual(['col'])
  })

  test('the space filter narrows both the lane and the columns', () => {
    const narrowed = boardView(snapshot, agents, { space: 'APP', sprint: { kind: 'all' } })
    expect(narrowed.waiting.map((item) => item.card.id)).toEqual(['other'])
  })

  test('the checklist keeps a card that is also in the lane', () => {
    const rowIds = view.rounds.flatMap((round) => round.rows.map((row) => row.item.card.id))
    expect(rowIds).toContain('ask')
  })
})

describe('sprint choice values', () => {
  test('every choice survives a round trip through a select value', () => {
    for (const choice of [{ kind: 'running' }, { kind: 'all' }, { kind: 'named', name: '6.45.0 · 25 พ.ย.' }] as const) {
      expect(sprintChoiceFromValue(sprintChoiceValue(choice))).toEqual(choice)
    }
  })
})

describe('filterOptions', () => {
  test('lists spaces and sprint names without duplicates', () => {
    const snapshot: BoardSnapshot = {
      cards: [cardWith({ space: 'OPS' }), cardWith({ space: 'APP' }), cardWith({ space: 'OPS' })],
      sprints: [RUNNING, PLANNED],
      error: null,
      at: 0
    }
    expect(filterOptions(snapshot)).toEqual({ spaces: ['APP', 'OPS'], sprints: ['2026-W48', '2026-W49'] })
  })
})
