import { matchRepoId, type HandoffDraft } from '@shared/handoff'
import { cleanPrompt, isValidBaseBranch, isValidName, isValidPrompt } from '@shared/spawn'
import { fillTemplate, templateValues, type QuestTemplate } from '@shared/templates'
import type { OrcaRepo, SpawnRequest } from '@shared/types'

export type SpawnFields = { repoId: string; name: string; baseBranch: string; prompt: string }

export type SpawnProblems = { repo: boolean; name: boolean; baseBranch: boolean; prompt: boolean }

export const EMPTY_FIELDS: SpawnFields = { repoId: '', name: '', baseBranch: '', prompt: '' }

export function fieldsFromDraft(draft: HandoffDraft | null): SpawnFields {
  if (draft === null) {
    return EMPTY_FIELDS
  }
  return {
    repoId: '',
    name: draft.name,
    baseBranch: draft.baseBranch,
    prompt: draft.prompt
  }
}

export function resolveRepoId(repos: readonly OrcaRepo[], selectedRepoId: string, draft: HandoffDraft | null): string {
  if (selectedRepoId !== '') {
    return selectedRepoId
  }
  if (draft !== null) {
    return matchRepoId(repos, draft.repoName)
  }
  return repos[0]?.id ?? ''
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
