import { describe, expect, test } from 'bun:test'
import { PROMPT_MAX } from '@shared/spawn'
import type { QuestTemplate } from '@shared/templates'
import { applyTemplate, buildSpawnRequest, EMPTY_FIELDS, shouldConfirmReplace, spawnProblems } from './spawn-logic'

const FILLED = { ...EMPTY_FIELDS, repoId: 'r1', name: 'fix-login' }

describe('spawn form', () => {
  test('a name and a repo are enough and empty optional fields are left out', () => {
    expect(buildSpawnRequest(FILLED)).toEqual({ repoId: 'r1', name: 'fix-login' })
  })

  test('the prompt is trimmed and the base branch is carried', () => {
    expect(buildSpawnRequest({ ...FILLED, baseBranch: ' origin/main ', prompt: '  go\n' })).toEqual({
      repoId: 'r1',
      name: 'fix-login',
      baseBranch: 'origin/main',
      prompt: 'go'
    })
  })

  test('a valid form has no problems', () => {
    expect(spawnProblems(FILLED)).toEqual({ repo: false, name: false, baseBranch: false, prompt: false })
  })

  test('a missing repo, a bad name, a dash branch and a long prompt are each flagged', () => {
    expect(spawnProblems({ ...FILLED, repoId: '' }).repo).toBe(true)
    expect(spawnProblems({ ...FILLED, name: 'Fix Login' }).name).toBe(true)
    expect(spawnProblems({ ...FILLED, baseBranch: '-x' }).baseBranch).toBe(true)
    expect(spawnProblems({ ...FILLED, prompt: 'x'.repeat(4001) }).prompt).toBe(true)
  })
})

const REVIEW: QuestTemplate = {
  id: 'review-branch',
  name: 'รีวิว branch',
  prompt: 'Review the diff against {{branch}} in {{repo}} for {{name}}. {{nmae}}',
  baseBranch: null,
  namePrefix: 'review-'
}

describe('applying a template', () => {
  test('empty fields get the prefix, main as the branch and the repo name', () => {
    const applied = applyTemplate({ ...EMPTY_FIELDS, repoId: 'r1' }, REVIEW, 'cozu')
    expect(applied.name).toBe('review-')
    expect(applied.baseBranch).toBe('')
    expect(applied.prompt).toBe('Review the diff against main in cozu for review-. {{nmae}}')
  })

  test('a typed base branch lands in the prompt and is kept', () => {
    const applied = applyTemplate({ ...FILLED, baseBranch: 'origin/dev' }, REVIEW, 'cozu')
    expect(applied.baseBranch).toBe('origin/dev')
    expect(applied.prompt).toContain('against origin/dev in')
  })

  test('filled name and branch are not overwritten by the template', () => {
    const template = { ...REVIEW, baseBranch: 'origin/other' }
    const applied = applyTemplate({ ...FILLED, baseBranch: 'origin/dev' }, template, 'cozu')
    expect(applied.name).toBe('fix-login')
    expect(applied.baseBranch).toBe('origin/dev')
  })

  test('an empty base branch takes the template one', () => {
    const applied = applyTemplate(FILLED, { ...REVIEW, baseBranch: 'origin/other' }, 'cozu')
    expect(applied.baseBranch).toBe('origin/other')
    expect(applied.prompt).toContain('against origin/other in')
  })

  test('a template without a prefix leaves an empty name empty', () => {
    expect(applyTemplate(EMPTY_FIELDS, { ...REVIEW, namePrefix: null }, 'cozu').name).toBe('')
  })

  test('a filled prompt over the limit is flagged like any other', () => {
    const applied = applyTemplate(FILLED, { ...REVIEW, prompt: '{{name}}'.repeat(PROMPT_MAX) }, 'cozu')
    expect(spawnProblems(applied).prompt).toBe(true)
  })

  test('the request from a template equals one typed by hand with that text', () => {
    const applied = applyTemplate({ ...FILLED, baseBranch: 'origin/dev' }, REVIEW, 'cozu')
    const typed = { ...FILLED, baseBranch: 'origin/dev', prompt: 'Review the diff against origin/dev in cozu for fix-login. {{nmae}}' }
    expect(buildSpawnRequest(applied)).toEqual(buildSpawnRequest(typed))
  })
})

describe('replacing a typed prompt', () => {
  test('an empty prompt is replaced without asking', () => {
    expect(shouldConfirmReplace('  ', '')).toBe(false)
  })

  test('typed text asks first', () => {
    expect(shouldConfirmReplace('my own words', '')).toBe(true)
  })

  test('text that a template filled and nobody edited is replaced without asking', () => {
    expect(shouldConfirmReplace('filled', 'filled')).toBe(false)
  })

  test('a template text that was edited asks first', () => {
    expect(shouldConfirmReplace('filled and changed', 'filled')).toBe(true)
  })
})
