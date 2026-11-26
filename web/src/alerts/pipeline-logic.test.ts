import { describe, expect, test } from 'bun:test'
import type { BoardSnapshot, PipelineStatus, QuestCard } from '@shared/types'
import { advancePipelines, pipelineAlertText, pipelineChanges, shouldPoll } from './pipeline-logic'

function card(id: string, pipeline: PipelineStatus | null | undefined, key: string | null = id): QuestCard {
  return {
    id,
    key,
    title: `title ${id}`,
    space: 'OPS',
    status: '',
    column: 'review',
    priority: null,
    assignee: null,
    sprint: null,
    epic: null,
    labels: [],
    route: 'agent',
    updatedAt: '2026-11-01',
    url: '',
    loop: null,
    mergeRequest: pipeline === undefined ? null : { iid: 1, url: '', state: 'opened', pipeline, tags: [] }
  }
}

function snapshot(cards: QuestCard[], error: string | null = null): BoardSnapshot {
  return { cards, sprints: [], error, at: 1 }
}

function kinds(previous: BoardSnapshot | null, current: BoardSnapshot): string[] {
  return pipelineChanges(previous, current).map((change) => `${change.card.id}:${change.kind}`)
}

describe('pipelineChanges', () => {
  test('a card going from running to failed is reported as failed', () => {
    expect(kinds(snapshot([card('A', 'running')]), snapshot([card('A', 'failed')]))).toEqual(['A:failed'])
  })

  test('a card going from success, pending or no pipeline to failed is reported', () => {
    for (const before of ['success', 'pending', null] as const) {
      expect(kinds(snapshot([card('A', before)]), snapshot([card('A', 'failed')]))).toEqual(['A:failed'])
    }
  })

  test('a card that stays failed over many reloads is reported once', () => {
    const first = snapshot([card('A', 'running')])
    const second = snapshot([card('A', 'failed')])
    const third = snapshot([card('A', 'failed')])
    expect(kinds(first, second)).toEqual(['A:failed'])
    expect(kinds(second, third)).toEqual([])
    expect(kinds(third, snapshot([card('A', 'failed')]))).toEqual([])
  })

  test('a card going from failed to success is reported as recovered', () => {
    expect(kinds(snapshot([card('A', 'failed')]), snapshot([card('A', 'success')]))).toEqual(['A:recovered'])
  })

  test('a card going from failed to running is not recovered yet', () => {
    expect(kinds(snapshot([card('A', 'failed')]), snapshot([card('A', 'running')]))).toEqual([])
  })

  test('a null previous snapshot is silent even with a red pipeline', () => {
    expect(kinds(null, snapshot([card('A', 'failed')]))).toEqual([])
  })

  test('a card that appears already failed in the second snapshot is reported', () => {
    expect(kinds(snapshot([card('B', 'success')]), snapshot([card('B', 'success'), card('A', 'failed')]))).toEqual(['A:failed'])
  })

  test('a card that appears already successful is not recovered', () => {
    expect(kinds(snapshot([]), snapshot([card('A', 'success')]))).toEqual([])
  })

  test('a card with no merge request is never reported', () => {
    expect(kinds(snapshot([card('A', undefined)]), snapshot([card('A', undefined)]))).toEqual([])
    expect(kinds(snapshot([card('A', 'failed')]), snapshot([card('A', undefined)]))).toEqual([])
  })

  test('cards are matched by id, not by key', () => {
    const before = snapshot([card('one', 'running', 'APP-1')])
    const after = snapshot([card('two', 'failed', 'APP-1')])
    expect(kinds(before, after)).toEqual(['two:failed'])
  })

  test('reports each card on its own', () => {
    const before = snapshot([card('A', 'running'), card('B', 'failed'), card('C', 'running')])
    const after = snapshot([card('A', 'failed'), card('B', 'success'), card('C', 'running')])
    expect(kinds(before, after)).toEqual(['A:failed', 'B:recovered'])
  })
})

describe('advancePipelines', () => {
  test('the first snapshot sets the baseline and reports nothing', () => {
    const first = snapshot([card('A', 'failed')])
    expect(advancePipelines(null, first)).toEqual({ seen: first, changes: [] })
  })

  test('a snapshot with an error is skipped and keeps what was seen', () => {
    const seen = snapshot([card('A', 'running')])
    const step = advancePipelines(seen, snapshot([card('A', 'failed')], 'tracker_down'))
    expect(step.seen).toBe(seen)
    expect(step.changes).toEqual([])
  })

  test('an error before any baseline leaves the baseline empty', () => {
    const step = advancePipelines(null, snapshot([], 'tracker_down'))
    expect(step.seen).toBeNull()
    expect(step.changes).toEqual([])
  })

  test('a failed reload does not re-announce a red pipeline afterwards', () => {
    const failed = snapshot([card('A', 'failed')])
    const afterError = advancePipelines(failed, snapshot([], 'tracker_down'))
    const next = advancePipelines(afterError.seen, snapshot([card('A', 'failed')]))
    expect(next.changes).toEqual([])
  })

  test('a good snapshot after an error still reports a real change', () => {
    const running = snapshot([card('A', 'running')])
    const afterError = advancePipelines(running, snapshot([], 'tracker_down'))
    const next = advancePipelines(afterError.seen, snapshot([card('A', 'failed')]))
    expect(next.changes.map((change) => change.kind)).toEqual(['failed'])
  })
})

describe('pipelineAlertText', () => {
  test('uses the card key and title with the failed body', () => {
    expect(pipelineAlertText({ card: card('A', 'failed', 'OPS-11'), kind: 'failed' })).toEqual({
      title: 'OPS-11 title A',
      body: 'pipeline ไม่ผ่าน'
    })
  })

  test('uses the recovered body', () => {
    expect(pipelineAlertText({ card: card('A', 'success', 'OPS-11'), kind: 'recovered' }).body).toBe('pipeline กลับมาผ่านแล้ว')
  })

  test('falls back to the title when the card has no key', () => {
    expect(pipelineAlertText({ card: card('A', 'failed', null), kind: 'failed' }).title).toBe('title A')
  })
})

describe('shouldPoll', () => {
  test('a visible tab always reloads', () => {
    expect(shouldPoll(false, 'visible')).toBe(true)
    expect(shouldPoll(true, 'visible')).toBe(true)
  })

  test('a hidden tab reloads only when alerts keep it polling', () => {
    expect(shouldPoll(true, 'hidden')).toBe(true)
    expect(shouldPoll(false, 'hidden')).toBe(false)
  })
})
