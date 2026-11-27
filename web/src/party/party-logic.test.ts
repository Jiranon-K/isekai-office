import { describe, expect, test } from 'bun:test'
import type { AgentState, OfficeAgent, QuestCard } from '@shared/types'
import {
  canReceive,
  colourOf,
  PARTY_COLOURS,
  partyByAgentId,
  partyKeyOf,
  parties,
  receivers,
  skippedWithReason,
  SKIP_REASONS
} from './party-logic'

function agent(id: string, overrides: Partial<OfficeAgent> = {}): OfficeAgent {
  return {
    id,
    title: `session ${id}`,
    repo: null,
    workspace: null,
    worktree: null,
    session: null,
    contextTokens: null,
    state: 'done',
    tool: null,
    lastMessage: null,
    updatedAt: 0,
    activeAt: 0,
    terminal: `t-${id}`,
    ...overrides
  }
}

function card(key: string, epic: string | null, overrides: Partial<QuestCard> = {}): QuestCard {
  return {
    id: key,
    key,
    title: `${key} title`,
    space: 'APP',
    status: 'doing',
    column: 'doing',
    priority: null,
    assignee: null,
    sprint: null,
    epic,
    labels: [],
    route: 'agent',
    updatedAt: '2026-01-01T00:00:00.000Z',
    url: '',
    loop: null,
    mergeRequest: null,
    ...overrides
  }
}

function keyed(id: string, key: string, repo: string | null = null): OfficeAgent {
  return agent(id, { title: `${key} work`, repo })
}

describe('partyKeyOf', () => {
  test('uses the epic of the card matched to the agent', () => {
    expect(partyKeyOf(keyed('a', 'APP-1', 'web'), [card('APP-1', 'Checkout')])).toBe('epic:Checkout')
  })

  test('falls back to the repo when the matched card has no epic', () => {
    expect(partyKeyOf(keyed('a', 'APP-1', 'web'), [card('APP-1', null)])).toBe('repo:web')
  })

  test('falls back to the repo when no card matches', () => {
    expect(partyKeyOf(keyed('a', 'APP-1', 'web'), [card('APP-2', 'Checkout')])).toBe('repo:web')
  })

  test('is null for an agent with neither epic nor repo', () => {
    expect(partyKeyOf(keyed('a', 'APP-1'), [card('APP-1', null)])).toBeNull()
  })

  test('matches a card through the loop worktree', () => {
    const matched = agent('a', { worktree: '/w/a', repo: 'web' })
    const cards = [card('APP-9', 'Billing', { loop: { status: 'working', mr: null, worktree: '/w/a', session: null } })]
    expect(partyKeyOf(matched, cards)).toBe('epic:Billing')
  })

  test('prefers the epic of an open card over a done one', () => {
    const cards = [card('APP-1', 'Old', { column: 'done', updatedAt: '2026-02-01T00:00:00.000Z' }), card('APP-1', 'Current')]
    expect(partyKeyOf(keyed('a', 'APP-1'), cards)).toBe('epic:Current')
  })
})

describe('parties', () => {
  test('two agents on cards of one epic form one party named after the epic', () => {
    const found = parties([keyed('a', 'APP-1'), keyed('b', 'APP-2')], [card('APP-1', 'Checkout'), card('APP-2', 'Checkout')])
    expect(found.map((party) => [party.kind, party.name, party.members.map((member) => member.id)])).toEqual([
      ['epic', 'Checkout', ['a', 'b']]
    ])
  })

  test('two agents of one repo with no epic form a repo party', () => {
    const found = parties([keyed('a', 'APP-1', 'web'), keyed('b', 'APP-2', 'web')], [])
    expect(found.map((party) => [party.kind, party.name])).toEqual([['repo', 'web']])
  })

  test('an agent in an epic party is not counted again in its repo party', () => {
    const agents = [keyed('a', 'APP-1', 'web'), keyed('b', 'APP-2', 'web'), keyed('c', 'APP-3', 'web')]
    const found = parties(agents, [card('APP-1', 'Checkout'), card('APP-2', 'Checkout')])
    expect(found.map((party) => [party.key, party.members.map((member) => member.id)])).toEqual([['epic:Checkout', ['a', 'b']]])
  })

  test('two repo mates plus an epic pair make both parties', () => {
    const agents = [keyed('a', 'APP-1', 'web'), keyed('b', 'APP-2', 'web'), keyed('c', 'APP-3', 'web'), keyed('d', 'APP-4', 'web')]
    const found = parties(agents, [card('APP-1', 'Checkout'), card('APP-2', 'Checkout')])
    expect(found.map((party) => party.key)).toEqual(['epic:Checkout', 'repo:web'])
    expect(found[1]?.members.map((member) => member.id)).toEqual(['c', 'd'])
  })

  test('an agent alone on its epic joins its repo party', () => {
    const agents = [keyed('a', 'APP-1', 'web'), keyed('b', 'APP-2', 'web')]
    const found = parties(agents, [card('APP-1', 'Checkout')])
    expect(found.map((party) => party.key)).toEqual(['repo:web'])
  })

  test('a single agent is in no party', () => {
    expect(parties([keyed('a', 'APP-1', 'web')], [card('APP-1', 'Checkout')])).toEqual([])
  })

  test('an agent with neither epic nor repo is in no party', () => {
    expect(parties([keyed('a', 'APP-1'), keyed('b', 'APP-2')], [])).toEqual([])
  })

  test('partyByAgentId maps each member to its party', () => {
    const found = parties([keyed('a', 'APP-1', 'web'), keyed('b', 'APP-2', 'web'), keyed('c', 'APP-3', 'api')], [])
    const byAgent = partyByAgentId(found)
    expect(byAgent.get('a')?.key).toBe('repo:web')
    expect(byAgent.get('b')?.key).toBe('repo:web')
    expect(byAgent.has('c')).toBe(false)
  })
})

describe('colourOf', () => {
  test('gives the same colour to the same key every time', () => {
    expect(colourOf('epic:Checkout')).toBe(colourOf('epic:Checkout'))
    expect(colourOf('epic:Checkout')).toBe('party-1')
  })

  test('always returns one of the six party colours', () => {
    const keys = Array.from({ length: 200 }, (_, index) => `repo:r${index}`)
    expect(keys.every((key) => PARTY_COLOURS.includes(colourOf(key)))).toBe(true)
  })

  test('uses every colour across many keys', () => {
    const keys = Array.from({ length: 200 }, (_, index) => `repo:r${index}`)
    expect(new Set(keys.map(colourOf)).size).toBe(PARTY_COLOURS.length)
  })

  test('a party carries the colour of its key', () => {
    const found = parties([keyed('a', 'APP-1', 'web'), keyed('b', 'APP-2', 'web')], [])
    expect(found[0]?.colour).toBe(colourOf('repo:web'))
  })
})

describe('canReceive and reasons', () => {
  const states: [AgentState, string | null][] = [
    ['done', null],
    ['working', SKIP_REASONS.working],
    ['waiting', SKIP_REASONS.asking],
    ['blocked', SKIP_REASONS.asking]
  ]

  test.each(states)('an agent that is %s with a terminal', (state, reason) => {
    const found = parties([agent('a', { state, repo: 'web' }), agent('b', { repo: 'web' })], [])
    const party = found[0]!
    expect(canReceive(party.members[0]!)).toBe(reason === null)
    expect(skippedWithReason(party).find((skipped) => skipped.agent.id === 'a')?.reason ?? null).toBe(reason)
  })

  test('an agent without a terminal is skipped for that reason even when done', () => {
    const found = parties([agent('a', { terminal: null, repo: 'web' }), agent('b', { repo: 'web' })], [])
    expect(skippedWithReason(found[0]!)).toEqual([{ agent: found[0]!.members[0]!, reason: SKIP_REASONS.noTerminal }])
  })

  test('a party of three with one working has two receivers and one skip', () => {
    const found = parties([agent('a', { repo: 'web' }), agent('b', { repo: 'web', state: 'working' }), agent('c', { repo: 'web' })], [])
    const party = found[0]!
    expect(receivers(party).map((member) => member.id)).toEqual(['a', 'c'])
    expect(skippedWithReason(party).map((skipped) => [skipped.agent.id, skipped.reason])).toEqual([['b', SKIP_REASONS.working]])
  })
})
