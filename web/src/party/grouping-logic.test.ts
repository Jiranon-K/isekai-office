import { describe, expect, test } from 'bun:test'
import type { OfficeAgent } from '@shared/types'
import { parseGrouping, serializeGrouping, soloAgents } from './grouping-logic'
import { colourOf, type Party } from './party-logic'

function agent(id: string): OfficeAgent {
  return {
    id,
    title: id,
    repo: 'web',
    workspace: null,
    worktree: null,
    session: null,
    contextTokens: null,
    state: 'done',
    tool: null,
    lastMessage: null,
    updatedAt: 0,
    activeAt: 0,
    terminal: null
  }
}

describe('grouping preference', () => {
  test('is off when nothing was stored', () => {
    expect(parseGrouping(null)).toBe(false)
  })

  test('round-trips both values', () => {
    expect(parseGrouping(serializeGrouping(true))).toBe(true)
    expect(parseGrouping(serializeGrouping(false))).toBe(false)
  })

  test('treats unknown stored text as off', () => {
    expect(parseGrouping('maybe')).toBe(false)
  })
})

describe('soloAgents', () => {
  test('keeps only the agents that are in no party', () => {
    const party: Party = { key: 'repo:web', kind: 'repo', name: 'web', colour: colourOf('repo:web'), members: [agent('a'), agent('b')] }
    expect(soloAgents([agent('a'), agent('b'), agent('c')], [party]).map((solo) => solo.id)).toEqual(['c'])
  })

  test('returns everyone when there are no parties', () => {
    expect(soloAgents([agent('a'), agent('b')], [])).toHaveLength(2)
  })
})
