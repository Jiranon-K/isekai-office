import { describe, expect, test } from 'bun:test'
import { toTemplates, type QuestTemplate } from '@shared/templates'
import {
  draftFromTemplate,
  draftProblems,
  draftToTemplate,
  EMPTY_TEMPLATE_DRAFT,
  hasDraftProblem,
  nextTemplateId,
  removeTemplate,
  upsertTemplate
} from './template-edit-logic'

const ONE: QuestTemplate = { id: 'quest-1', name: 'หนึ่ง', prompt: 'do', baseBranch: null, namePrefix: null }
const VALID = { name: 'ชื่อ', prompt: 'ทำ', baseBranch: '', namePrefix: '' }

describe('template draft', () => {
  test('an empty draft has a name and prompt problem only', () => {
    expect(draftProblems(EMPTY_TEMPLATE_DRAFT)).toEqual({ name: true, prompt: true, baseBranch: false, namePrefix: false })
  })

  test('a valid draft has no problem', () => {
    expect(hasDraftProblem(draftProblems(VALID))).toBe(false)
  })

  test('a draft the form accepts is accepted by the server rules', () => {
    const draft = { name: ' ชื่อ ', prompt: ' ทำ ', baseBranch: ' origin/dev ', namePrefix: ' fix- ' }
    expect(hasDraftProblem(draftProblems(draft))).toBe(false)
    expect(toTemplates({ templates: [draftToTemplate(draft, 'quest-1')] })).not.toBeNull()
  })

  test('flags a dashed base branch, a bad prefix and a long name', () => {
    expect(draftProblems({ ...VALID, baseBranch: '-x' }).baseBranch).toBe(true)
    expect(draftProblems({ ...VALID, namePrefix: 'Fix-' }).namePrefix).toBe(true)
    expect(draftProblems({ ...VALID, name: 'x'.repeat(41) }).name).toBe(true)
    expect(draftProblems({ ...VALID, prompt: 'x'.repeat(4001) }).prompt).toBe(true)
  })

  test('blank optional fields become null and the rest is trimmed', () => {
    expect(draftToTemplate({ ...VALID, name: ' ชื่อ ' }, 'quest-2')).toEqual({
      id: 'quest-2',
      name: 'ชื่อ',
      prompt: 'ทำ',
      baseBranch: null,
      namePrefix: null
    })
  })

  test('a template round trips through a draft', () => {
    const template = { ...ONE, baseBranch: 'origin/dev', namePrefix: 'fix-' }
    expect(draftToTemplate(draftFromTemplate(template), template.id)).toEqual(template)
  })
})

describe('template list edits', () => {
  test('the next id skips ids in use', () => {
    expect(nextTemplateId([])).toBe('quest-1')
    expect(nextTemplateId([ONE])).toBe('quest-2')
    expect(nextTemplateId([{ ...ONE, id: 'quest-2' }])).toBe('quest-3')
  })

  test('upsert adds a new template at the end and replaces an existing one in place', () => {
    const two = { ...ONE, id: 'quest-2' }
    expect(upsertTemplate([ONE], two)).toEqual([ONE, two])
    expect(upsertTemplate([ONE, two], { ...ONE, name: 'ใหม่' })).toEqual([{ ...ONE, name: 'ใหม่' }, two])
  })

  test('remove drops one template by id', () => {
    expect(removeTemplate([ONE, { ...ONE, id: 'quest-2' }], 'quest-1')).toEqual([{ ...ONE, id: 'quest-2' }])
  })
})
