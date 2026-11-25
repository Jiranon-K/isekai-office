import { describe, expect, test } from 'bun:test'
import type { MergeRequestFacts, QuestCard, Sprint } from '@shared/types'
import { DEFAULT_FILTER, type BoardItem } from './monitor-logic'
import { daysLeft, furthestTag, gatesFor, releaseRounds, tagStage } from './release-logic'

function cardWith(overrides: Partial<QuestCard>): QuestCard {
  return {
    id: 'id', key: 'APP-1', title: 'title', space: 'APP', status: 'x', column: 'doing', priority: null,
    assignee: null, sprint: '6.45.0', epic: null, labels: [], route: null, updatedAt: '', url: '',
    loop: null, mergeRequest: null, ...overrides
  }
}

function loopCard(status: string, mergeRequest: MergeRequestFacts | null = null, overrides: Partial<QuestCard> = {}): QuestCard {
  const loop = { status, mr: 'https://host/group/repo/-/merge_requests/515', worktree: null, session: null }
  return cardWith({ loop, mergeRequest, ...overrides })
}

function facts(overrides: Partial<MergeRequestFacts>): MergeRequestFacts {
  return { iid: 515, url: 'https://host/group/repo/-/merge_requests/515', state: 'merged', pipeline: 'success', tags: [], ...overrides }
}

const SPRINT: Sprint = { space: 'APP', name: '6.45.0', state: 'running', endDate: '2026-11-25', goal: null }

describe('tagStage', () => {
  test('beta is dev, rc is staging, a plain version is production', () => {
    expect(tagStage('v6.43.0-beta.1')).toBe('dev')
    expect(tagStage('v6.43.0-rc.1')).toBe('staging')
    expect(tagStage('v6.43.0')).toBe('production')
  })

  test('a tag with no known shape has no stage', () => {
    expect(tagStage('release-candidate')).toBeNull()
  })
})

describe('furthestTag', () => {
  test('the production tag wins over earlier stages', () => {
    expect(furthestTag(['v6.43.0-beta.1', 'v6.43.0', 'v6.43.0-rc.1'])).toEqual({ tag: 'v6.43.0', stage: 'production' })
  })

  test('no recognised tag gives null', () => {
    expect(furthestTag(['nightly'])).toBeNull()
  })
})

describe('gatesFor a card outside the Loop', () => {
  test('every gate is unknown except merged, which follows the Workspace column', () => {
    const gates = gatesFor(cardWith({ column: 'doing' }))
    expect(gates.spec).toEqual({ state: 'unknown', detail: 'นอก Loop', url: null })
    expect(gates.mr.state).toBe('unknown')
    expect(gates.merged.state).toBe('unknown')
    expect(gates.tag.state).toBe('unknown')
  })

  test('a done card passes merged with the Workspace note', () => {
    expect(gatesFor(cardWith({ column: 'done' })).merged).toEqual({ state: 'pass', detail: 'ตาม Workspace', url: null })
  })
})

describe('gatesFor a card in the Loop', () => {
  test('a design waiting for the owner holds the spec gate', () => {
    expect(gatesFor(loopCard('design_ready')).spec).toEqual({ state: 'wait', detail: 'รอตรวจ', url: null })
    expect(gatesFor(loopCard('working')).spec.state).toBe('pass')
  })

  test('the mr gate links to the merge request and names its number', () => {
    const gate = gatesFor(loopCard('mr_open', facts({ state: 'opened' }))).mr
    expect(gate).toEqual({ state: 'pass', detail: '!515', url: 'https://host/group/repo/-/merge_requests/515' })
  })

  test('the mr number comes from the loop url when GitLab did not answer', () => {
    expect(gatesFor(loopCard('mr_open')).mr.detail).toBe('!515')
  })

  test('missing GitLab facts leave pipeline and tag unknown, not failed', () => {
    const gates = gatesFor(loopCard('mr_open'))
    expect(gates.pipeline.state).toBe('unknown')
    expect(gates.tag.state).toBe('unknown')
  })

  test('pipeline maps success, failure and running', () => {
    expect(gatesFor(loopCard('mr_open', facts({ pipeline: 'success' }))).pipeline.state).toBe('pass')
    expect(gatesFor(loopCard('mr_open', facts({ pipeline: 'failed' }))).pipeline.state).toBe('fail')
    expect(gatesFor(loopCard('mr_open', facts({ pipeline: 'running' }))).pipeline).toEqual({ state: 'wait', detail: 'running', url: null })
  })

  test('merged follows the merge request state', () => {
    expect(gatesFor(loopCard('mr_open', facts({ state: 'opened' }))).merged.state).toBe('wait')
    expect(gatesFor(loopCard('mr_open', facts({ state: 'closed' }))).merged.state).toBe('fail')
    expect(gatesFor(loopCard('merged', facts({ state: 'merged' }))).merged.state).toBe('pass')
  })

  test('a closed merge request passes merged when the Loop says merged', () => {
    const gates = gatesFor(loopCard('merged', facts({ state: 'closed' })))
    expect(gates.merged).toMatchObject({ state: 'pass', detail: 'merge นอก MR' })
  })

  test('a closed merge request has an unknown tag gate', () => {
    expect(gatesFor(loopCard('merged', facts({ state: 'closed' }))).tag.state).toBe('unknown')
  })

  test('merged falls back to the loop status when facts are missing', () => {
    expect(gatesFor(loopCard('merged')).merged.state).toBe('pass')
  })

  test('a staging tag waits and shows the tag name, a production tag passes', () => {
    const staging = gatesFor(loopCard('merged', facts({ tags: ['v6.45.0-beta.1', 'v6.45.0-rc.1'] }))).tag
    expect(staging).toEqual({ state: 'wait', detail: 'v6.45.0-rc.1', url: null })
    const production = gatesFor(loopCard('merged', facts({ tags: ['v6.45.0-rc.1', 'v6.45.0'] }))).tag
    expect(production).toEqual({ state: 'pass', detail: 'v6.45.0', url: null })
  })

  test('a merged request in no tag waits with no detail', () => {
    expect(gatesFor(loopCard('merged', facts({ tags: [] }))).tag).toEqual({ state: 'wait', detail: null, url: null })
  })
})

describe('releaseRounds', () => {
  const today = new Date(2026, 10, 24)
  const items: BoardItem[] = [
    { card: loopCard('merged', facts({ tags: ['v6.45.0'] }), { id: 'a' }), agent: null, reason: null },
    { card: cardWith({ id: 'b' }), agent: null, reason: null },
    { card: cardWith({ id: 'c', sprint: '6.46.0' }), agent: null, reason: null },
    { card: cardWith({ id: 'd', space: 'OPS' }), agent: null, reason: null }
  ]

  test('a round lists every card of the sprint, outside-Loop cards included', () => {
    const [round] = releaseRounds(items, [SPRINT], DEFAULT_FILTER, today)
    expect(round?.rows.map((row) => row.item.card.id)).toEqual(['a', 'b'])
  })

  test('progress counts passes over all rows so gray rows hold the bar back', () => {
    const [round] = releaseRounds(items, [SPRINT], DEFAULT_FILTER, today)
    expect(round?.progress.tag).toEqual({ pass: 1, total: 2 })
  })

  test('days left counts to the end date', () => {
    const [round] = releaseRounds(items, [SPRINT], DEFAULT_FILTER, today)
    expect(round?.daysLeft).toBe(1)
  })

  test('the default filter skips planned sprints and a named filter picks one', () => {
    const planned: Sprint = { ...SPRINT, name: '6.46.0', state: 'planned' }
    expect(releaseRounds(items, [SPRINT, planned], DEFAULT_FILTER, today).map((round) => round.sprint.name)).toEqual(['6.45.0'])
    const named = { space: null, sprint: { kind: 'named', name: '6.46.0' } } as const
    expect(releaseRounds(items, [SPRINT, planned], named, today).map((round) => round.sprint.name)).toEqual(['6.46.0'])
  })

  test('the space filter limits rounds to that product', () => {
    const second: Sprint = { space: 'OPS', name: '6.45.0', state: 'running', endDate: null, goal: null }
    const filter = { space: 'OPS', sprint: { kind: 'running' } } as const
    const rounds = releaseRounds(items, [SPRINT, second], filter, today)
    expect(rounds.map((round) => round.sprint.space)).toEqual(['OPS'])
  })
})

describe('daysLeft', () => {
  test('no end date gives null and a past date gives a negative count', () => {
    expect(daysLeft(null, new Date(2026, 10, 24))).toBeNull()
    expect(daysLeft('2026-11-22', new Date(2026, 10, 24))).toBe(-2)
  })
})
