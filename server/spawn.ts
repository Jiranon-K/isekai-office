import type { OrcaRepo, SpawnRequest, SpawnResult } from '@shared/types'
import { cleanPrompt, isValidBaseBranch, isValidName, isValidPrompt } from '@shared/spawn'

export type SpawnFeeds = {
  repos(): Promise<OrcaRepo[]>
  spawn(request: SpawnRequest): Promise<SpawnResult>
}

export type SpawnReply = { status: number; result: SpawnResult }

const BAD_REQUEST: SpawnReply = { status: 400, result: { ok: false, error: 'bad_request' } }

function optionalText(body: object, key: string): string | null | undefined {
  const value = Reflect.get(body, key)
  if (value === undefined || value === null) {
    return null
  }
  return typeof value === 'string' ? value : undefined
}

export function toSpawn(body: unknown, repos: OrcaRepo[]): SpawnRequest | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const repoId = Reflect.get(body, 'repoId')
  const name = Reflect.get(body, 'name')
  const baseBranch = optionalText(body, 'baseBranch')
  const rawPrompt = optionalText(body, 'prompt')
  if (typeof repoId !== 'string' || !repos.some((repo) => repo.id === repoId)) {
    return null
  }
  if (typeof name !== 'string' || !isValidName(name)) {
    return null
  }
  if (baseBranch === undefined || (baseBranch !== null && !isValidBaseBranch(baseBranch))) {
    return null
  }
  if (rawPrompt === undefined) {
    return null
  }
  const prompt = rawPrompt === null ? null : cleanPrompt(rawPrompt)
  if (prompt !== null && !isValidPrompt(prompt)) {
    return null
  }
  return {
    repoId,
    name,
    ...(baseBranch === null ? {} : { baseBranch }),
    ...(prompt === null ? {} : { prompt })
  }
}

export async function handleSpawn(body: unknown, feeds: SpawnFeeds): Promise<SpawnReply> {
  let repos: OrcaRepo[]
  try {
    repos = await feeds.repos()
  } catch (error) {
    return { status: 502, result: { ok: false, error: error instanceof Error ? error.message : String(error) } }
  }
  const request = toSpawn(body, repos)
  if (!request) {
    return BAD_REQUEST
  }
  const result = await feeds.spawn(request)
  const status = !result.ok && result.error === 'too_many_sessions' ? 429 : 200
  return { status, result }
}
