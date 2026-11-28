import { describe, expect, test } from 'bun:test'
import type { ArchivedSession } from '@shared/archive'
import { PROMPT_MAX } from '@shared/spawn'
import {
  TEMPLATE_ID_PATTERN,
  TEMPLATE_LIMIT,
  TEMPLATE_NAME_MAX,
  toTemplates,
  type QuestTemplate
} from '@shared/templates'
import type { SessionEntry } from '@shared/types'
import {
  buildTemplateFromSession,
  collectRepos,
  firstUserPrompt,
  formatRelativeTime,
  mergeRepos,
  saveSessionAsTemplate
} from './archive-logic'

function makeTemplate(id: string): QuestTemplate {
  return { id, name: id, prompt: 'do work', baseBranch: null, namePrefix: null }
}

function makeSession(id: string, repo: string | null): ArchivedSession {
  return { id, title: `Session ${id}`, repo, modifiedAt: 1000, size: 100, active: false }
}

describe('firstUserPrompt', () => {
  test('returns the earliest non-empty user message and ignores assistant or blank entries', () => {
    const entries: SessionEntry[] = [
      { role: 'assistant', text: 'System intro', tools: [], at: 1 },
      { role: 'user', text: '   ', tools: [], at: 2 },
      { role: 'user', text: '  Add coupon validation  ', tools: [], at: 3 },
      { role: 'user', text: 'Second prompt', tools: [], at: 4 }
    ]
    expect(firstUserPrompt(entries)).toBe('Add coupon validation')
    expect(firstUserPrompt([{ role: 'assistant', text: 'hi', tools: [], at: 1 }])).toBeNull()
  })
})

describe('buildTemplateFromSession', () => {
  test('builds a valid QuestTemplate with unique slug ID and capped name and prompt', () => {
    const existing = [makeTemplate('app-8-checkout-coupon-validation')]
    const longTitle = 'APP-8 checkout coupon validation with extra long suffix beyond forty chars'
    const result = buildTemplateFromSession({ id: 'arch-1', title: longTitle }, 'p'.repeat(PROMPT_MAX + 50), existing)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(TEMPLATE_ID_PATTERN.test(result.template.id)).toBe(true)
    expect(result.template.name.length).toBeLessThanOrEqual(TEMPLATE_NAME_MAX)
    expect(result.template.prompt.length).toBeLessThanOrEqual(PROMPT_MAX)
    expect(toTemplates({ templates: [...existing, result.template] })).not.toBeNull()
  })

  test('disambiguates colliding slug IDs and falls back for Thai-only titles', () => {
    const existing = [makeTemplate('api-15-rate-limiter')]
    const collided = buildTemplateFromSession({ id: 'arch-2', title: 'API-15 rate limiter' }, 'add limiter', existing)
    expect(collided.ok).toBe(true)
    if (collided.ok) {
      expect(collided.template.id).toBe('api-15-rate-limiter-2')
    }

    const thai = buildTemplateFromSession({ id: 'arch-9', title: 'ตรวจสอบสิทธิ์ทั้งหมด' }, 'audit auth', [])
    expect(thai.ok).toBe(true)
    if (thai.ok) {
      expect(thai.template.id).toBe('arch-9')
      expect(thai.template.name).toBe('ตรวจสอบสิทธิ์ทั้งหมด')
      expect(toTemplates({ templates: [thai.template] })).not.toBeNull()
    }
  })

  test('rejects when template limit is reached or prompt is blank', () => {
    const full = Array.from({ length: TEMPLATE_LIMIT }, (_, index) => makeTemplate(`tpl-${index + 1}`))
    expect(buildTemplateFromSession({ id: 'a1', title: 'Task' }, 'prompt', full)).toEqual({
      ok: false,
      reason: 'limit_reached'
    })
    expect(buildTemplateFromSession({ id: 'a1', title: 'Task' }, '   ', [])).toEqual({
      ok: false,
      reason: 'empty_prompt'
    })
  })
})

describe('saveSessionAsTemplate', () => {
  test('appends new template and persists with server revision', async () => {
    let savedList: QuestTemplate[] = []
    let savedRev = ''
    const status = await saveSessionAsTemplate(
      { id: 'arch-1', title: 'APP-8 coupon' },
      'Add coupon checks',
      async () => ({ templates: [makeTemplate('fix-bug')], revision: 'rev-1' }),
      async (templates, revision) => {
        savedList = templates
        savedRev = revision
        return { ok: true, error: null, snapshot: { templates, revision: 'rev-2' } }
      }
    )
    expect(status).toEqual({ kind: 'saved' })
    expect(savedRev).toBe('rev-1')
    expect(savedList).toHaveLength(2)
    expect(savedList[1]?.id).toBe('app-8-coupon')
  })

  test('reports limit_reached and failure cleanly', async () => {
    const full = Array.from({ length: TEMPLATE_LIMIT }, (_, index) => makeTemplate(`tpl-${index + 1}`))
    const fullStatus = await saveSessionAsTemplate(
      { id: 'arch-1', title: 'Task' },
      'prompt',
      async () => ({ templates: full, revision: 'rev-1' }),
      async () => ({ ok: true, error: null, snapshot: null })
    )
    expect(fullStatus).toEqual({ kind: 'limit_reached' })

    const failedFetch = await saveSessionAsTemplate(
      { id: 'arch-1', title: 'Task' },
      'prompt',
      async () => {
        throw new Error('offline')
      },
      async () => ({ ok: true, error: null, snapshot: null })
    )
    expect(failedFetch.kind).toBe('failed')
  })
})

describe('formatRelativeTime', () => {
  const now = 10 * 24 * 60 * 60 * 1000

  test('formats minutes, hours, yesterday, and multi-day deltas in concise Thai', () => {
    expect(formatRelativeTime(now - 20_000, now)).toBe('เมื่อสักครู่')
    expect(formatRelativeTime(now - 15 * 60_000, now)).toBe('15 นาทีที่แล้ว')
    expect(formatRelativeTime(now - 2 * 3_600_000, now)).toBe('2 ชม. ที่แล้ว')
    expect(formatRelativeTime(now - 26 * 3_600_000, now)).toBe('เมื่อวาน')
    expect(formatRelativeTime(now - 50 * 3_600_000, now)).toBe('2 วันที่แล้ว')
  })
})

describe('collectRepos and mergeRepos', () => {
  test('returns sorted unique repo names and preserves previously seen repos', () => {
    const sessions = [makeSession('1', 'web-app'), makeSession('2', 'api'), makeSession('3', null), makeSession('4', 'web-app')]
    expect(collectRepos(sessions)).toEqual(['api', 'web-app'])
    expect(mergeRepos(['docs', 'infra'], [makeSession('2', 'api')])).toEqual(['api', 'docs', 'infra'])
  })
})
