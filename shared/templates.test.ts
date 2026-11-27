import { describe, expect, test } from 'bun:test'
import { PROMPT_MAX } from './spawn'
import { BUILT_IN_TEMPLATES, fillTemplate, templateValues, toTemplates, type QuestTemplate } from './templates'

const VALUES = { name: 'fix-login', repo: 'cozu', branch: 'origin/dev' }

function template(patch: Partial<QuestTemplate> = {}): QuestTemplate {
  return { id: 'one', name: 'หนึ่ง', prompt: 'do it', baseBranch: null, namePrefix: null, ...patch }
}

function many(count: number): QuestTemplate[] {
  return Array.from({ length: count }, (_, index) => template({ id: `t-${index}` }))
}

describe('fillTemplate', () => {
  test('fills the name, repo and branch placeholders', () => {
    expect(fillTemplate('{{name}} in {{repo}} from {{branch}}', VALUES)).toBe('fix-login in cozu from origin/dev')
  })

  test('leaves an unknown placeholder as written', () => {
    expect(fillTemplate('hello {{nmae}}', VALUES)).toBe('hello {{nmae}}')
  })

  test('fills a placeholder used twice', () => {
    expect(fillTemplate('{{repo}} and {{repo}}', VALUES)).toBe('cozu and cozu')
  })

  test('leaves a placeholder as written when its value is empty', () => {
    expect(fillTemplate('{{name}} in {{repo}}', { ...VALUES, name: '', repo: '' })).toBe('{{name}} in {{repo}}')
  })

  test('does not expand placeholders inside a filled value', () => {
    expect(fillTemplate('{{name}}', { ...VALUES, name: '{{repo}}' })).toBe('{{repo}}')
  })
})

describe('templateValues', () => {
  test('uses main when the base branch is empty', () => {
    expect(templateValues('a', 'b', '  ').branch).toBe('main')
  })

  test('uses the trimmed base branch when given', () => {
    expect(templateValues('a', 'b', ' origin/dev ').branch).toBe('origin/dev')
  })
})

describe('built-in templates', () => {
  test('are valid under the same rules as a saved list', () => {
    expect(toTemplates({ templates: BUILT_IN_TEMPLATES })).toEqual(BUILT_IN_TEMPLATES)
  })
})

describe('toTemplates', () => {
  test('accepts a valid list and an empty one', () => {
    expect(toTemplates({ templates: [template()] })).toEqual([template()])
    expect(toTemplates({ templates: [] })).toEqual([])
  })

  test('treats a missing base branch and prefix as null', () => {
    const bare = { id: 'a', name: 'a', prompt: 'p' }
    expect(toTemplates({ templates: [bare] })).toEqual([template({ id: 'a', name: 'a', prompt: 'p' })])
  })

  test('refuses a body that is not a list', () => {
    expect(toTemplates(null)).toBeNull()
    expect(toTemplates({})).toBeNull()
    expect(toTemplates({ templates: 'x' })).toBeNull()
    expect(toTemplates({ templates: [null] })).toBeNull()
  })

  test('refuses 31 templates and accepts 30', () => {
    expect(toTemplates({ templates: many(30) })).toHaveLength(30)
    expect(toTemplates({ templates: many(31) })).toBeNull()
  })

  test('refuses a duplicate id', () => {
    expect(toTemplates({ templates: [template(), template()] })).toBeNull()
  })

  test('refuses a bad id', () => {
    for (const id of ['', 'Up', 'a b', 'a'.repeat(41), 'a/b']) {
      expect(toTemplates({ templates: [template({ id })] })).toBeNull()
    }
  })

  test('refuses an empty or too long name', () => {
    expect(toTemplates({ templates: [template({ name: '' })] })).toBeNull()
    expect(toTemplates({ templates: [template({ name: 'x'.repeat(41) })] })).toBeNull()
    expect(toTemplates({ templates: [template({ name: 'x'.repeat(40) })] })).toHaveLength(1)
  })

  test('refuses an empty prompt or one over the limit', () => {
    expect(toTemplates({ templates: [template({ prompt: '' })] })).toBeNull()
    expect(toTemplates({ templates: [template({ prompt: 'x'.repeat(PROMPT_MAX + 1) })] })).toBeNull()
    expect(toTemplates({ templates: [template({ prompt: 'x'.repeat(PROMPT_MAX) })] })).toHaveLength(1)
  })

  test('refuses a base branch that starts with a dash or has bad characters', () => {
    expect(toTemplates({ templates: [template({ baseBranch: '-x' })] })).toBeNull()
    expect(toTemplates({ templates: [template({ baseBranch: 'a b' })] })).toBeNull()
    expect(toTemplates({ templates: [template({ baseBranch: 'origin/dev' })] })).toHaveLength(1)
  })

  test('refuses a bad name prefix', () => {
    for (const namePrefix of ['', '-x', 'Fix-', 'a'.repeat(21)]) {
      expect(toTemplates({ templates: [template({ namePrefix })] })).toBeNull()
    }
    expect(toTemplates({ templates: [template({ namePrefix: 'fix-' })] })).toHaveLength(1)
  })

  test('refuses fields of the wrong type', () => {
    expect(toTemplates({ templates: [{ ...template(), prompt: 5 }] })).toBeNull()
    expect(toTemplates({ templates: [{ ...template(), baseBranch: 5 }] })).toBeNull()
  })
})
