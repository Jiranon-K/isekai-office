import type { SpawnRequest } from '@shared/types'
import { cleanPrompt, isValidBaseBranch, isValidName, isValidPrompt } from '@shared/spawn'

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
