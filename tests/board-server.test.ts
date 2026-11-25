import { describe, expect, test } from 'bun:test'
import type { MergeRequestFacts, QuestCard, Sprint } from '@shared/types'
import { wantsMergeRequestFacts, withMergeRequest } from '../server/board-feed'
import { isFresh, parseMergeRequestUrl, toPipelineStatus } from '../server/gitlab'
import { toSprint } from '../server/workspace'

const MINUTE = 60_000
const MR_URL = 'https://gitlab.com/acme/web-app/-/merge_requests/515'

function facts(overrides: Partial<MergeRequestFacts>): MergeRequestFacts {
  return { iid: 515, url: MR_URL, state: 'opened', pipeline: null, tags: [], ...overrides }
}

function cardWith(overrides: Partial<QuestCard>): QuestCard {
  return {
    id: 'id', key: 'APP-1', title: 't', space: 'APP', status: 's', column: 'doing', priority: null, assignee: null,
    sprint: '6.45.0', epic: null, labels: [], route: null, updatedAt: '', url: '',
    loop: { status: 'mr_open', mr: MR_URL, worktree: null, session: null }, mergeRequest: null, ...overrides
  }
}

describe('parseMergeRequestUrl', () => {
  test('splits host, nested project path and iid', () => {
    expect(parseMergeRequestUrl(MR_URL)).toEqual({ url: MR_URL, host: 'gitlab.com', project: 'acme/web-app', iid: 515 })
    const nested = parseMergeRequestUrl('https://gitlab.com/a/b/c/-/merge_requests/7/diffs')
    expect(nested?.project).toBe('a/b/c')
    expect(nested?.iid).toBe(7)
  })

  test('a url that is not a merge request gives null', () => {
    expect(parseMergeRequestUrl('https://gitlab.com/a/b')).toBeNull()
    expect(parseMergeRequestUrl('not a url')).toBeNull()
  })
})

describe('isFresh', () => {
  test('an open request or a failed lookup is fresh for one minute', () => {
    expect(isFresh(facts({ state: 'opened' }), MINUTE - 1)).toBe(true)
    expect(isFresh(facts({ state: 'opened' }), MINUTE)).toBe(false)
    expect(isFresh(null, MINUTE)).toBe(false)
  })

  test('a merged request is fresh for ten minutes, forever once in a production tag', () => {
    expect(isFresh(facts({ state: 'merged', tags: ['v1.0.0-rc.1'] }), 9 * MINUTE)).toBe(true)
    expect(isFresh(facts({ state: 'merged', tags: ['v1.0.0-rc.1'] }), 11 * MINUTE)).toBe(false)
    expect(isFresh(facts({ state: 'merged', tags: ['v1.0.0'] }), 999 * MINUTE)).toBe(true)
  })

  test('a closed request never changes back', () => {
    expect(isFresh(facts({ state: 'closed' }), 999 * MINUTE)).toBe(true)
  })
})

describe('toPipelineStatus', () => {
  test('maps GitLab statuses to the five outcomes and keeps unknown ones as other', () => {
    expect(toPipelineStatus('success')).toBe('success')
    expect(toPipelineStatus('created')).toBe('pending')
    expect(toPipelineStatus('canceling')).toBe('canceled')
    expect(toPipelineStatus('manual')).toBe('other')
  })

  test('no pipeline gives null', () => {
    expect(toPipelineStatus(null)).toBeNull()
    expect(toPipelineStatus(undefined)).toBeNull()
  })
})

describe('toSprint', () => {
  test('keeps the fields the board needs', () => {
    const raw = { name: '6.45.0 · 25 พ.ย.', state: 'running', start_date: '2026-11-18', end_date: '2026-11-25', goal: 'Release' }
    expect(toSprint(raw, 'APP')).toEqual({ space: 'APP', name: '6.45.0 · 25 พ.ย.', state: 'running', endDate: '2026-11-25', goal: 'Release' })
  })

  test('a sprint with an unknown state or no name is dropped', () => {
    expect(toSprint({ name: 'x', state: 'weird' }, 'APP')).toBeNull()
    expect(toSprint({ state: 'running' }, 'APP')).toBeNull()
  })
})

describe('merge request facts on cards', () => {
  test('facts are attached by the loop merge request url', () => {
    const attached = withMergeRequest(cardWith({}), new Map([[MR_URL, facts({})]]))
    expect(attached.mergeRequest?.iid).toBe(515)
  })

  test('a card with no answer from GitLab keeps null', () => {
    expect(withMergeRequest(cardWith({}), new Map()).mergeRequest).toBeNull()
    expect(withMergeRequest(cardWith({ loop: null }), new Map([[MR_URL, facts({})]])).mergeRequest).toBeNull()
  })

  test('only cards of a running sprint or not yet done are looked up', () => {
    const running: Sprint = { space: 'APP', name: '6.45.0', state: 'running', endDate: null, goal: null }
    expect(wantsMergeRequestFacts(cardWith({ column: 'done' }), [running])).toBe(true)
    expect(wantsMergeRequestFacts(cardWith({ column: 'done', sprint: 'old' }), [running])).toBe(false)
    expect(wantsMergeRequestFacts(cardWith({ column: 'doing', sprint: 'old' }), [running])).toBe(true)
    expect(wantsMergeRequestFacts(cardWith({ loop: null }), [running])).toBe(false)
  })
})
