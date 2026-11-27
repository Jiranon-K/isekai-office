import type { SpawnRequest } from '@shared/types'
import { cleanPrompt, isValidBaseBranch, isValidName, isValidPrompt } from '@shared/spawn'
import { fillTemplate, templateValues, type QuestTemplate } from '@shared/templates'

export type SpawnFields = { repoId: string; name: string; baseBranch: string; prompt: string }

export type SpawnProblems = { repo: boolean; name: boolean; baseBranch: boolean; prompt: boolean }

export const EMPTY_FIELDS: SpawnFields = { repoId: '', name: '', baseBranch: '', prompt: '' }

export function spawnProblems(fields: SpawnFields): SpawnProblems {
  const baseBranch = fields.baseBranch.trim()
  const prompt = cleanPrompt(fields.prompt) ?? ''
  return {
    repo: fields.repoId === '',
    name: !isValidName(fields.name),
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

export function applyTemplate(fields: SpawnFields, template: QuestTemplate, repoName: string): SpawnFields {
  const baseBranch = fields.baseBranch.trim() === '' ? (template.baseBranch ?? fields.baseBranch) : fields.baseBranch
  const name = fields.name === '' ? (template.namePrefix ?? '') : fields.name
  const prompt = fillTemplate(template.prompt, templateValues(name, repoName, baseBranch))
  return { ...fields, name, baseBranch, prompt }
}

export function shouldConfirmReplace(prompt: string, lastFilled: string): boolean {
  return prompt.trim() !== '' && prompt !== lastFilled
}
