import { describe, expect, test } from 'bun:test'
import { buildSpawnRequest, EMPTY_FIELDS, spawnProblems } from './spawn-logic'

const FILLED = { ...EMPTY_FIELDS, repoId: 'r1', name: 'fix-login' }

describe('spawn form', () => {
  test('a name and a repo are enough and empty optional fields are left out', () => {
    expect(buildSpawnRequest(FILLED)).toEqual({ repoId: 'r1', name: 'fix-login' })
  })

  test('the prompt is trimmed and the base branch is carried', () => {
    expect(buildSpawnRequest({ ...FILLED, baseBranch: ' origin/main ', prompt: '  go\n' })).toEqual({
      repoId: 'r1',
      name: 'fix-login',
      baseBranch: 'origin/main',
      prompt: 'go'
    })
  })

  test('a valid form has no problems', () => {
    expect(spawnProblems(FILLED)).toEqual({ repo: false, name: false, baseBranch: false, prompt: false })
  })

  test('a missing repo, a bad name, a dash branch and a long prompt are each flagged', () => {
    expect(spawnProblems({ ...FILLED, repoId: '' }).repo).toBe(true)
    expect(spawnProblems({ ...FILLED, name: 'Fix Login' }).name).toBe(true)
    expect(spawnProblems({ ...FILLED, baseBranch: '-x' }).baseBranch).toBe(true)
    expect(spawnProblems({ ...FILLED, prompt: 'x'.repeat(4001) }).prompt).toBe(true)
  })
})
