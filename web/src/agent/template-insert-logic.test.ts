import { describe, expect, test } from 'bun:test'
import type { QuestTemplate } from '@shared/templates'
import { agentTemplateValues, insertAtCursor, insertTemplate, worktreeName } from './template-insert-logic'

const TEMPLATE: QuestTemplate = {
  id: 'review-branch',
  name: 'รีวิว',
  prompt: 'Review {{name}} in {{repo}} against {{branch}}',
  baseBranch: 'origin/dev',
  namePrefix: null
}

describe('worktreeName', () => {
  test('takes the last folder of a posix or windows path', () => {
    expect(worktreeName('/home/me/cozu/.claude/worktrees/fix-login')).toBe('fix-login')
    expect(worktreeName('D:\\work\\cozu\\fix-login\\')).toBe('fix-login')
  })

  test('is empty without a worktree', () => {
    expect(worktreeName(null)).toBe('')
  })
})

describe('agentTemplateValues', () => {
  test('uses the agent repo and worktree name and main for the branch', () => {
    expect(agentTemplateValues({ repo: 'cozu', worktree: '/w/fix-login' })).toEqual({ name: 'fix-login', repo: 'cozu', branch: 'main' })
  })

  test('uses empty text for a missing repo', () => {
    expect(agentTemplateValues({ repo: null, worktree: null })).toEqual({ name: '', repo: '', branch: 'main' })
  })
})

describe('insertTemplate with missing values', () => {
  test('keeps the placeholders of values the agent does not have', () => {
    const values = agentTemplateValues({ repo: null, worktree: null })
    expect(insertTemplate('', 0, 0, TEMPLATE, values).text).toBe('Review {{name}} in {{repo}} against main')
  })
})

describe('insertAtCursor', () => {
  test('inserts at the cursor and moves it after the insertion', () => {
    expect(insertAtCursor('abcd', 2, 2, 'XY')).toEqual({ text: 'abXYcd', cursor: 4 })
  })

  test('replaces a selection', () => {
    expect(insertAtCursor('abcd', 1, 3, 'X')).toEqual({ text: 'aXd', cursor: 2 })
  })

  test('clamps a cursor outside the text', () => {
    expect(insertAtCursor('ab', 9, 12, 'X')).toEqual({ text: 'abX', cursor: 3 })
  })

  test('inserts into an empty box', () => {
    expect(insertAtCursor('', 0, 0, 'X')).toEqual({ text: 'X', cursor: 1 })
  })
})

describe('insertTemplate', () => {
  test('inserts the filled prompt using the agent values', () => {
    const values = agentTemplateValues({ repo: 'cozu', worktree: '/w/fix-login' })
    expect(insertTemplate('go: ', 4, 4, TEMPLATE, values).text).toBe('go: Review fix-login in cozu against main')
  })
})
