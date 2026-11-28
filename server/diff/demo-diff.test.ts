import { describe, expect, test } from 'bun:test'
import { demoDiff } from './demo-diff'

describe('demoDiff', () => {
  test('returns spec fixture for a1', () => {
    const diff = demoDiff('a1')
    expect(diff.agentId).toBe('a1')
    expect(diff.branch).toBe('feat/dark-mode')
    expect(diff.files).toHaveLength(3)
    expect(diff.totalAdded).toBe(64)
    expect(diff.totalRemoved).toBe(12)
    expect(diff.truncated).toBe(false)
    expect(diff.error).toBeNull()
    expect(diff.files.some((file) => file.status === 'modified')).toBe(true)
    expect(diff.files.some((file) => file.status === 'added')).toBe(true)
  })

  test('returns spec fixture for a5', () => {
    const diff = demoDiff('a5')
    expect(diff.branch).toBe('feat/onboarding')
    expect(diff.files).toHaveLength(2)
    expect(diff.totalAdded).toBe(38)
    expect(diff.totalRemoved).toBe(4)
    expect(diff.files.map((file) => file.status)).toEqual(['modified', 'untracked'])
  })

  test('returns spec fixture for a7', () => {
    const diff = demoDiff('a7')
    expect(diff.branch).toBe('feat/empty-states')
    expect(diff.files).toHaveLength(4)
    expect(diff.totalAdded).toBe(112)
    expect(diff.totalRemoved).toBe(29)
    const statuses = new Set(diff.files.map((file) => file.status))
    expect(statuses.has('modified')).toBe(true)
    expect(statuses.has('added')).toBe(true)
    expect(statuses.has('deleted')).toBe(true)
  })

  test('returns clean worktree for a8 and no_worktree for a6', () => {
    const clean = demoDiff('a8')
    expect(clean.branch).toBe('docs/changelog')
    expect(clean.files).toEqual([])
    expect(clean.totalAdded).toBe(0)
    expect(clean.totalRemoved).toBe(0)
    expect(clean.error).toBeNull()

    const missing = demoDiff('a6')
    expect(missing.branch).toBeNull()
    expect(missing.files).toEqual([])
    expect(missing.error).toBe('no_worktree')
  })

  test('returns fallback modified file for other demo agents', () => {
    const diff = demoDiff('a2')
    expect(diff.agentId).toBe('a2')
    expect(diff.files).toHaveLength(1)
    expect(diff.files[0]?.status).toBe('modified')
    expect(diff.totalAdded).toBe(14)
    expect(diff.totalRemoved).toBe(3)
    expect(diff.error).toBeNull()
  })
})
