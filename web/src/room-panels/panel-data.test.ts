import { describe, expect, test } from 'bun:test'
import type { AgentState, BoardSnapshot, OfficeAgent, QuestCard } from '@shared/types'
import { cardsToVerify, doneSessions, loadRows, loopHistory, rosterOrder, waitingCount } from './panel-data'

function agentWith(id: string, state: AgentState, contextTokens: number | null = null, updatedAt = 0): OfficeAgent {
  return { id, title: id, repo: null, workspace: null, worktree: null, session: null, contextTokens, state, tool: null, lastMessage: null, updatedAt, activeAt: updatedAt, terminal: null }
}

function cardWith(id: string, loopStatus: string | null, column: QuestCard['column'] = 'doing'): QuestCard {
  return {
    id,
    key: id,
    title: id,
    space: 'OPS',
    status: '',
    column,
    priority: null,
    assignee: null,
    sprint: null,
    epic: null,
    labels: [],
    route: 'agent',
    updatedAt: '2026-11-01',
    url: '',
    loop: loopStatus ? { status: loopStatus, mr: null, worktree: null, session: null } : null,
    mergeRequest: null
  }
}

function snapshotOf(cards: QuestCard[]): BoardSnapshot {
  return { cards, sprints: [], error: null, at: 1 }
}

describe('reception roster', () => {
  test('sessions that wait for the owner come first', () => {
    const order = rosterOrder([agentWith('a', 'working'), agentWith('b', 'blocked'), agentWith('c', 'done'), agentWith('d', 'waiting')])
    expect(order.slice(0, 2).map((agent) => agent.id).sort()).toEqual(['b', 'd'])
  })

  test('keeps every session', () => {
    expect(rosterOrder([agentWith('a', 'working'), agentWith('b', 'done')])).toHaveLength(2)
  })
})

describe('crystal orb rows', () => {
  test('the heaviest session comes first and unknown loads last', () => {
    const rows = loadRows([agentWith('low', 'working', 100_000), agentWith('none', 'working'), agentWith('high', 'working', 900_000)], 1_000_000)
    expect(rows.map((row) => row.agent.id)).toEqual(['high', 'low', 'none'])
  })
})

describe('bar shelf', () => {
  test('lists only finished sessions, newest first', () => {
    const done = doneSessions([agentWith('old', 'done', null, 1), agentWith('busy', 'working'), agentWith('new', 'done', null, 2)])
    expect(done.map((agent) => agent.id)).toEqual(['new', 'old'])
  })

  test('lists open cards whose MR waits for a verify', () => {
    const cards = cardsToVerify(snapshotOf([cardWith('A', 'mr_open'), cardWith('B', 'working'), cardWith('C', 'mr_open', 'done')]))
    expect(cards.map((card) => card.id)).toEqual(['A'])
  })

  test('has nothing to verify before the board loads', () => {
    expect(cardsToVerify(null)).toEqual([])
  })
})

describe('loop history', () => {
  test('keeps only cards the Loop has touched, blocked ones first', () => {
    const history = loopHistory(snapshotOf([cardWith('merged', 'merged'), cardWith('plain', null), cardWith('stuck', 'blocked')]))
    expect(history.map((card) => card.id)).toEqual(['stuck', 'merged'])
  })

  test('is empty before the board loads', () => {
    expect(loopHistory(null)).toEqual([])
  })
})

describe('waiting count', () => {
  test('counts cards that wait for the owner', () => {
    expect(waitingCount(snapshotOf([cardWith('A', 'design_ready'), cardWith('B', 'working')]), [])).toBe(1)
  })

  test('is zero before the board loads', () => {
    expect(waitingCount(null, [])).toBe(0)
  })
})
