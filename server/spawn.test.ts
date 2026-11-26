import { describe, expect, test } from 'bun:test'
import type { OrcaRepo, SpawnRequest, SpawnResult } from '@shared/types'
import { handleSpawn, type SpawnFeeds, toSpawn } from './spawn'

const REPOS: OrcaRepo[] = [
  { id: 'repo-1', name: 'alpha' },
  { id: 'repo-2', name: 'beta' }
]

function valid(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { repoId: 'repo-1', name: 'fix-login', ...overrides }
}

describe('toSpawn', () => {
  test('a minimal body is accepted', () => {
    expect(toSpawn(valid(), REPOS)).toEqual({ repoId: 'repo-1', name: 'fix-login' })
  })

  test('every field is carried and the prompt is trimmed', () => {
    expect(toSpawn(valid({ baseBranch: 'origin/main', prompt: '  do it \n' }), REPOS)).toEqual({
      repoId: 'repo-1',
      name: 'fix-login',
      baseBranch: 'origin/main',
      prompt: 'do it'
    })
  })

  test('an empty or blank prompt means absent', () => {
    expect(toSpawn(valid({ prompt: '' }), REPOS)).toEqual({ repoId: 'repo-1', name: 'fix-login' })
    expect(toSpawn(valid({ prompt: ' \n\t ' }), REPOS)).toEqual({ repoId: 'repo-1', name: 'fix-login' })
  })

  test('null optional fields mean absent', () => {
    expect(toSpawn(valid({ baseBranch: null, prompt: null }), REPOS)).toEqual({ repoId: 'repo-1', name: 'fix-login' })
  })

  test('a repo id that is not in the list is refused', () => {
    expect(toSpawn(valid({ repoId: 'repo-9' }), REPOS)).toBeNull()
    expect(toSpawn(valid({ repoId: 7 }), REPOS)).toBeNull()
    expect(toSpawn({ name: 'fix-login' }, REPOS)).toBeNull()
  })

  test('a name with a space, an uppercase letter, a leading dash or 49 characters is refused', () => {
    for (const name of ['fix login', 'Fix-login', '-fix', '', 'a'.repeat(49), 'fix_login', 'fix\n', 7, undefined]) {
      expect(toSpawn(valid({ name }), REPOS)).toBeNull()
    }
  })

  test('a name of 48 characters is accepted', () => {
    expect(toSpawn(valid({ name: 'a'.repeat(48) }), REPOS)?.name).toBe('a'.repeat(48))
  })

  test('a base branch that starts with a dash or has odd characters is refused', () => {
    for (const baseBranch of ['-x', '--upload-pack=x', 'a b', 'a;b', '', 'a'.repeat(101), 7]) {
      expect(toSpawn(valid({ baseBranch }), REPOS)).toBeNull()
    }
  })

  test('a prompt of 4000 characters is accepted and 4001 is refused', () => {
    expect(toSpawn(valid({ prompt: 'x'.repeat(4000) }), REPOS)?.prompt).toHaveLength(4000)
    expect(toSpawn(valid({ prompt: 'x'.repeat(4001) }), REPOS)).toBeNull()
    expect(toSpawn(valid({ prompt: 12 }), REPOS)).toBeNull()
  })

  test('a body that is not an object is refused', () => {
    expect(toSpawn(null, REPOS)).toBeNull()
    expect(toSpawn('x', REPOS)).toBeNull()
  })
})

function recorder(result: SpawnResult = { ok: true, error: null }): { calls: SpawnRequest[]; feeds: SpawnFeeds } {
  const calls: SpawnRequest[] = []
  return {
    calls,
    feeds: {
      repos: async () => REPOS,
      spawn: async (request) => {
        calls.push(request)
        return result
      }
    }
  }
}

describe('handleSpawn', () => {
  test('a valid body calls spawn exactly once with the parsed request', async () => {
    const { calls, feeds } = recorder()
    const reply = await handleSpawn(valid({ prompt: ' hi ' }), feeds)
    expect(reply).toEqual({ status: 200, result: { ok: true, error: null } })
    expect(calls).toEqual([{ repoId: 'repo-1', name: 'fix-login', prompt: 'hi' }])
  })

  test('each invalid body answers 400 and calls nothing', async () => {
    const bodies = [
      valid({ repoId: 'nope' }),
      valid({ name: 'has space' }),
      valid({ name: 'Upper' }),
      valid({ baseBranch: '-x' }),
      valid({ prompt: 'x'.repeat(4001) }),
      null
    ]
    for (const body of bodies) {
      const { calls, feeds } = recorder()
      const reply = await handleSpawn(body, feeds)
      expect(reply.status).toBe(400)
      expect(reply.result.ok).toBe(false)
      expect(calls).toEqual([])
    }
  })

  test('an Orca failure is passed through with its message', async () => {
    const { feeds } = recorder({ ok: false, error: 'branch exists' })
    expect(await handleSpawn(valid(), feeds)).toEqual({ status: 200, result: { ok: false, error: 'branch exists' } })
  })

  test('a repo list that cannot be read answers 502 and calls nothing', async () => {
    const calls: SpawnRequest[] = []
    const reply = await handleSpawn(valid(), {
      repos: async () => {
        throw new Error('orca down')
      },
      spawn: async (request) => {
        calls.push(request)
        return { ok: true, error: null }
      }
    })
    expect(reply).toEqual({ status: 502, result: { ok: false, error: 'orca down' } })
    expect(calls).toEqual([])
  })
})
