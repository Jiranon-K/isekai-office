import type { ArchivedSession } from '@shared/archive'
import { PROMPT_MAX } from '@shared/spawn'
import { TEMPLATE_LIMIT, TEMPLATE_NAME_MAX, type QuestTemplate, type TemplateSnapshot } from '@shared/templates'
import type { SessionEntry } from '@shared/types'
import type { TemplateSaveResult } from '@/lib/templates-api'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const TEMPLATE_ID_MAX = 40

export type TemplateBuildResult =
  | { ok: true; template: QuestTemplate }
  | { ok: false; reason: 'limit_reached' | 'empty_prompt' }

export type SaveTemplateStatus =
  | { kind: 'saved' }
  | { kind: 'limit_reached' }
  | { kind: 'failed'; reason: string }

function slugifyId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function uniqueTemplateId(
  title: string,
  sessionId: string,
  existingTemplates: readonly QuestTemplate[]
): string {
  const taken = new Set(existingTemplates.map((template) => template.id))
  const rawBase = slugifyId(title) || slugifyId(sessionId) || 'session'
  const base = rawBase.slice(0, TEMPLATE_ID_MAX).replace(/-+$/g, '') || 'session'
  if (!taken.has(base)) {
    return base
  }
  let suffix = 2
  while (true) {
    const tag = `-${suffix}`
    const prefix = base.slice(0, TEMPLATE_ID_MAX - tag.length).replace(/-+$/g, '') || 'session'
    const candidate = `${prefix}${tag}`
    if (!taken.has(candidate)) {
      return candidate
    }
    suffix += 1
  }
}

function cleanTemplateName(title: string, sessionId: string): string {
  const stripped = [...title].filter((character) => character.charCodeAt(0) >= 0x20).join('').trim()
  const base = stripped || sessionId.trim() || 'แม่แบบจากเซสชัน'
  if (base.length <= TEMPLATE_NAME_MAX) {
    return base
  }
  return `${base.slice(0, TEMPLATE_NAME_MAX - 1).trimEnd()}…`
}

export function firstUserPrompt(entries: readonly SessionEntry[]): string | null {
  const entry = entries.find((item) => item.role === 'user' && item.text.trim() !== '')
  return entry ? entry.text.trim() : null
}

export function buildTemplateFromSession(
  session: Pick<ArchivedSession, 'id' | 'title'>,
  prompt: string,
  existingTemplates: readonly QuestTemplate[]
): TemplateBuildResult {
  if (existingTemplates.length >= TEMPLATE_LIMIT) {
    return { ok: false, reason: 'limit_reached' }
  }
  const trimmedPrompt = prompt.trim()
  if (trimmedPrompt === '') {
    return { ok: false, reason: 'empty_prompt' }
  }
  const cappedPrompt =
    trimmedPrompt.length <= PROMPT_MAX ? trimmedPrompt : trimmedPrompt.slice(0, PROMPT_MAX).trimEnd()
  return {
    ok: true,
    template: {
      id: uniqueTemplateId(session.title, session.id, existingTemplates),
      name: cleanTemplateName(session.title, session.id),
      prompt: cappedPrompt,
      baseBranch: null,
      namePrefix: null
    }
  }
}

export async function saveSessionAsTemplate(
  session: Pick<ArchivedSession, 'id' | 'title'>,
  prompt: string,
  loadTemplates: () => Promise<TemplateSnapshot>,
  persistTemplates: (templates: QuestTemplate[], revision: string) => Promise<TemplateSaveResult>
): Promise<SaveTemplateStatus> {
  let snapshot: TemplateSnapshot
  try {
    snapshot = await loadTemplates()
  } catch {
    return { kind: 'failed', reason: 'templates_unavailable' }
  }
  const built = buildTemplateFromSession(session, prompt, snapshot.templates)
  if (!built.ok) {
    if (built.reason === 'limit_reached') {
      return { kind: 'limit_reached' }
    }
    return { kind: 'failed', reason: built.reason }
  }
  const saved = await persistTemplates([...snapshot.templates, built.template], snapshot.revision)
  if (!saved.ok) {
    return { kind: 'failed', reason: saved.error ?? 'save_failed' }
  }
  return { kind: 'saved' }
}

export function formatRelativeTime(modifiedAt: number, now: number): string {
  const diff = Math.max(0, now - modifiedAt)
  if (diff < MINUTE_MS) {
    return 'เมื่อสักครู่'
  }
  if (diff < HOUR_MS) {
    return `${Math.floor(diff / MINUTE_MS)} นาทีที่แล้ว`
  }
  if (diff < DAY_MS) {
    return `${Math.floor(diff / HOUR_MS)} ชม. ที่แล้ว`
  }
  const days = Math.floor(diff / DAY_MS)
  if (days === 1) {
    return 'เมื่อวาน'
  }
  return `${days} วันที่แล้ว`
}

export function collectRepos(sessions: readonly ArchivedSession[]): string[] {
  const repos = new Set<string>()
  for (const session of sessions) {
    if (session.repo && session.repo.trim() !== '') {
      repos.add(session.repo.trim())
    }
  }
  return [...repos].sort()
}

export function mergeRepos(known: readonly string[], sessions: readonly ArchivedSession[]): string[] {
  const merged = new Set(known)
  for (const repo of collectRepos(sessions)) {
    merged.add(repo)
  }
  return [...merged].sort()
}
