import { cleanPrompt, isValidBaseBranch, isValidName, isValidPrompt } from '@shared/spawn'
import { fillTemplate, templateValues, type QuestTemplate } from '@shared/templates'
import type { OrcaRepo, SpawnRequest } from '@shared/types'
import { READ_ONLY_REASON } from '@/lib/source-caps'

export type SpawnFields = { repoId: string; name: string; baseBranch: string; prompt: string }

export type SpawnProblems = { repo: boolean; name: boolean; baseBranch: boolean; prompt: boolean }

export const EMPTY_FIELDS: SpawnFields = { repoId: '', name: '', baseBranch: '', prompt: '' }

export const EMPTY_REPOS_NOTE = 'ยังไม่พบโฟลเดอร์โปรเจกต์ ตั้งค่า LOCAL_REPOS หรือเปิด Claude Code ในโปรเจกต์ก่อน'

export function describeSpawnError(error: string | null): string {
  if (error === 'too_many_sessions') {
    return 'เปิด session พร้อมกันครบ 4 ตัวแล้ว ปิดตัวเก่าก่อน'
  }
  if (error === 'read_only_source') {
    return READ_ONLY_REASON
  }
  if (error === 'repos_unavailable') {
    return 'อ่านรายชื่อโฟลเดอร์โปรเจกต์ไม่ได้'
  }
  if (error === 'server_unreachable') {
    return 'ติดต่อ server ไม่ได้'
  }
  return error ?? 'spawn_failed'
}

export function describeReposError(error: string | null): string {
  if (error === 'repos_unavailable') {
    return 'อ่านรายชื่อโฟลเดอร์โปรเจกต์ไม่ได้'
  }
  return error ?? 'อ่านรายชื่อโฟลเดอร์โปรเจกต์ไม่ได้'
}

export function hasEmptyRepos(
  data: readonly OrcaRepo[] | null,
  loading: boolean,
  error: string | null
): boolean {
  return !loading && error === null && data !== null && data.length === 0
}

export function isBarePrefix(name: string, template: QuestTemplate | null): boolean {
  return template !== null && template.namePrefix !== null && name === template.namePrefix
}

export function spawnProblems(fields: SpawnFields, template: QuestTemplate | null = null): SpawnProblems {
  const baseBranch = fields.baseBranch.trim()
  const prompt = cleanPrompt(fields.prompt) ?? ''
  return {
    repo: fields.repoId === '',
    name: !isValidName(fields.name) || isBarePrefix(fields.name, template),
    baseBranch: baseBranch !== '' && !isValidBaseBranch(baseBranch),
    prompt: !isValidPrompt(prompt)
  }
}

export function hasProblem(problems: SpawnProblems): boolean {
  return Object.values(problems).some(Boolean)
}

export function buildSpawnRequest(fields: SpawnFields): SpawnRequest {
  const baseBranch = fields.baseBranch.trim()
  const prompt = cleanPrompt(fields.prompt)
  return {
    repoId: fields.repoId,
    name: fields.name,
    ...(baseBranch ? { baseBranch } : {}),
    ...(prompt ? { prompt } : {})
  }
}

export function applyTemplate(fields: SpawnFields, template: QuestTemplate): SpawnFields {
  const baseBranch = fields.baseBranch.trim() === '' ? (template.baseBranch ?? fields.baseBranch) : fields.baseBranch
  const name = fields.name === '' ? (template.namePrefix ?? '') : fields.name
  return { ...fields, name, baseBranch, prompt: template.prompt }
}

export function fillSpawnPrompt(fields: SpawnFields, template: QuestTemplate | null, repoName: string): string {
  if (template === null) {
    return fields.prompt
  }
  const name = isBarePrefix(fields.name, template) ? '' : fields.name
  return fillTemplate(fields.prompt, templateValues(name, repoName, fields.baseBranch))
}

export function withFilledPrompt(fields: SpawnFields, template: QuestTemplate | null, repoName: string): SpawnFields {
  return { ...fields, prompt: fillSpawnPrompt(fields, template, repoName) }
}

export function shouldConfirmReplace(prompt: string, lastFilled: string): boolean {
  return prompt.trim() !== '' && prompt !== lastFilled
}
