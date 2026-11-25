import { describe, expect, test } from 'bun:test'
import type { QuestCard } from '@shared/types'
import { classifyBoardError, formatTokenCount, groupByColumn, isHighPriority, loopStageLabel, loopStartPrompt, visibleLabels } from './board-logic'

function cardIn(column: QuestCard['column'], id: string): QuestCard {
  return {
    id, key: id, title: id, space: 'OPS', status: 'x', column, priority: null, assignee: null,
    sprint: null, epic: null, labels: [], route: null, updatedAt: '', url: '', loop: null, mergeRequest: null
  }
}

describe('loopStageLabel', () => {
  test('maps a known stage to its short label', () => {
    expect(loopStageLabel('mr_open')).toBe('MR เปิดแล้ว')
  })

  test('returns an unknown stage unchanged', () => {
    expect(loopStageLabel('weird')).toBe('weird')
  })
})

describe('groupByColumn', () => {
  const groups = groupByColumn([cardIn('todo', 'a'), cardIn('done', 'b'), cardIn('todo', 'c')].map((card) => ({ card })))

  test('collects cards under their column in order', () => {
    expect(groups.todo.map((item) => item.card.id)).toEqual(['a', 'c'])
  })

  test('keeps empty columns present', () => {
    expect(groups.review).toEqual([])
  })
})

describe('card helpers', () => {
  test('flags urgent priority regardless of case', () => {
    expect(isHighPriority('Urgent')).toBe(true)
  })

  test('ignores medium priority', () => {
    expect(isHighPriority('MEDIUM')).toBe(false)
  })

  test('keeps only type and risk labels', () => {
    expect(visibleLabels(['type:bug', 'agent', 'risk:low'])).toEqual(['type:bug', 'risk:low'])
  })

  test('builds the jk-loop:start prompt', () => {
    expect(loopStartPrompt('OPS-541')).toBe('/jk-loop:start OPS-541')
  })
})

describe('formatTokenCount', () => {
  test('prints thousands as k and small counts as they are', () => {
    expect(formatTokenCount(144_488)).toBe('144k')
    expect(formatTokenCount(950)).toBe('950')
  })
})

describe('classifyBoardError', () => {
  test('recognises a missing token', () => {
    expect(classifyBoardError('missing_token')).toBe('missing_token')
  })

  test('falls back to generic for anything else', () => {
    expect(classifyBoardError('boom')).toBe('generic')
  })
})
