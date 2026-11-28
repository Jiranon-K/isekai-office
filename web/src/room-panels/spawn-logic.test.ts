import { describe, expect, test } from 'bun:test'
import type { HandoffDraft } from '@shared/handoff'
import { PROMPT_MAX } from '@shared/spawn'
import type { QuestTemplate } from '@shared/templates'
import {
  applyTemplate,
  buildSpawnRequest,
  EMPTY_FIELDS,
  fieldsFromDraft,
  fillSpawnPrompt,
  resolveRepoId,
  shouldConfirmReplace,
  spawnProblems,
  withFilledPrompt
} from './spawn-logic'

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
  test('empty fields get the prefix and the template text with its placeholders', () => {
    const applied = applyTemplate({ ...EMPTY_FIELDS, repoId: 'r1' }, REVIEW)
    expect(applied.name).toBe('review-')
    expect(applied.baseBranch).toBe('')
    expect(applied.prompt).toBe(REVIEW.prompt)
  })

  test('filled name and branch are not overwritten by the template', () => {
    const template = { ...REVIEW, baseBranch: 'origin/other' }
    const applied = applyTemplate({ ...FILLED, baseBranch: 'origin/dev' }, template)
    expect(applied.name).toBe('fix-login')
    expect(applied.baseBranch).toBe('origin/dev')
  })

  test('an empty base branch takes the template one', () => {
    expect(applyTemplate(FILLED, { ...REVIEW, baseBranch: 'origin/other' }).baseBranch).toBe('origin/other')
  })

  test('a template without a prefix leaves an empty name empty', () => {
    expect(applyTemplate(EMPTY_FIELDS, { ...REVIEW, namePrefix: null }).name).toBe('')
  })
})

describe('filling the prompt at submit', () => {
  test('uses the final name, repo and base branch', () => {
    const fields = { ...FILLED, baseBranch: 'origin/dev', prompt: REVIEW.prompt }
    expect(fillSpawnPrompt(fields, REVIEW, 'cozu')).toBe('Review the diff against origin/dev in cozu for fix-login. {{nmae}}')
  })

  test('a name or branch changed after picking is used, not the one at pick time', () => {
    const picked = applyTemplate({ ...EMPTY_FIELDS, repoId: 'r1' }, REVIEW)
    const edited = { ...picked, name: 'review-auth', baseBranch: 'origin/dev' }
    expect(fillSpawnPrompt(edited, REVIEW, 'api')).toBe('Review the diff against origin/dev in api for review-auth. {{nmae}}')
  })

  test('a bare prefix is never filled into {{name}}', () => {
    const picked = applyTemplate({ ...EMPTY_FIELDS, repoId: 'r1' }, REVIEW)
    expect(fillSpawnPrompt(picked, REVIEW, 'cozu')).toContain('for {{name}}.')
  })

  test('a bare prefix is flagged as a name problem, a completed name is not', () => {
    const picked = applyTemplate({ ...EMPTY_FIELDS, repoId: 'r1' }, REVIEW)
    expect(spawnProblems(picked, REVIEW).name).toBe(true)
    expect(spawnProblems({ ...picked, name: 'review-auth' }, REVIEW).name).toBe(false)
  })

  test('without a template the prompt is left as typed', () => {
    expect(fillSpawnPrompt({ ...FILLED, prompt: 'hi {{name}}' }, null, 'cozu')).toBe('hi {{name}}')
  })

  test('a filled prompt over the limit is flagged like any other', () => {
    const fields = { ...FILLED, prompt: '{{name}}'.repeat(PROMPT_MAX) }
    expect(spawnProblems(withFilledPrompt(fields, REVIEW, 'cozu'), REVIEW).prompt).toBe(true)
  })

  test('the request from a template equals one typed by hand with that text', () => {
    const fields = { ...FILLED, baseBranch: 'origin/dev', prompt: REVIEW.prompt }
    const typed = { ...FILLED, baseBranch: 'origin/dev', prompt: 'Review the diff against origin/dev in cozu for fix-login. {{nmae}}' }
    expect(buildSpawnRequest(withFilledPrompt(fields, REVIEW, 'cozu'))).toEqual(buildSpawnRequest(typed))
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

const DRAFT: HandoffDraft = {
  sourceAgentId: 'a7',
  sourceTitle: 'APP-9 empty states',
  repoName: 'tavern-web',
  name: 'handoff-app-9-empty-states',
  baseBranch: 'main',
  prompt: 'Handoff from: APP-9 empty states',
  fallbackUsed: false
}

describe('handoff draft spawn fields', () => {
  const repos = [
    { id: 'r1', name: 'tavern-api' },
    { id: 'r2', name: 'tavern-web' }
  ]

  test('maps a handoff draft into initial spawn fields and resets when null', () => {
    expect(fieldsFromDraft(DRAFT)).toEqual({
      repoId: '',
      name: 'handoff-app-9-empty-states',
      baseBranch: 'main',
      prompt: 'Handoff from: APP-9 empty states'
    })
    expect(fieldsFromDraft(null)).toEqual(EMPTY_FIELDS)
  })

  test('resolves repoId from draft name until the user picks a repo explicitly', () => {
    expect(resolveRepoId(repos, '', DRAFT)).toBe('r2')
    expect(resolveRepoId(repos, 'r1', DRAFT)).toBe('r1')
    expect(resolveRepoId(repos, '', null)).toBe('r1')
  })
})
