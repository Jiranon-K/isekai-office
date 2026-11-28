import { describe, expect, test } from 'bun:test'
import type { AgentDiff, DiffSummary } from '@shared/diff'
import type { OfficeAgent } from '@shared/types'
import {
  classifyDiffState,
  formatDiffSummary,
  indexDiffSummaries,
  STATUS_CODE,
  STATUS_VARIANT,
  summaryIdsKey
} from './diff-logic'

function makeDiff(overrides: Partial<AgentDiff> = {}): AgentDiff {
  return {
    agentId: 'a1',
    branch: 'feat/dark-mode',
    files: [{ path: 'web/src/App.tsx', status: 'modified', added: 12, removed: 4 }],
    totalAdded: 12,
    totalRemoved: 4,
    truncated: false,
    error: null,
    ...overrides
  }
}

describe('status badge maps', () => {
  test('maps all five file statuses to short codes and badge variants', () => {
    expect(STATUS_CODE).toEqual({
      modified: 'M',
      added: 'A',
      deleted: 'D',
      renamed: 'R',
      untracked: '?'
    })
    expect(STATUS_VARIANT.modified).toBe('amber')
    expect(STATUS_VARIANT.added).toBe('green')
    expect(STATUS_VARIANT.deleted).toBe('red')
    expect(STATUS_VARIANT.renamed).toBe('blue')
    expect(STATUS_VARIANT.untracked).toBe('muted')
  })
})

describe('classifyDiffState', () => {
  test('returns loading while initial fetch is in flight', () => {
    expect(classifyDiffState(null, true, null)).toEqual({ kind: 'loading' })
    expect(classifyDiffState(null, true, 'diff_unavailable')).toEqual({ kind: 'loading' })
  })

  test('returns error on network failure or git failure', () => {
    expect(classifyDiffState(null, false, 'diff_unavailable')).toEqual({ kind: 'error' })
    expect(classifyDiffState(makeDiff({ files: [], error: 'git_unavailable' }), false, null)).toEqual({ kind: 'error' })
    expect(classifyDiffState(makeDiff({ files: [], error: 'not_a_repo' }), false, null)).toEqual({ kind: 'error' })
  })

  test('distinguishes no_worktree from generic errors', () => {
    expect(classifyDiffState(makeDiff({ files: [], branch: null, error: 'no_worktree' }), false, null)).toEqual({
      kind: 'no_worktree'
    })
  })

  test('returns empty when worktree is clean and files when changes exist', () => {
    expect(classifyDiffState(makeDiff({ files: [], branch: 'docs/changelog' }), false, null)).toEqual({
      kind: 'empty',
      branch: 'docs/changelog'
    })
    const diff = makeDiff()
    expect(classifyDiffState(diff, false, null)).toEqual({ kind: 'files', diff })
  })
})

describe('formatDiffSummary', () => {
  test('formats changed count, clean state, and hides unavailable summaries', () => {
    const changed: DiffSummary = { agentId: 'a7', files: 4, added: 112, removed: 29, clean: false, unavailable: false }
    const clean: DiffSummary = { agentId: 'a8', files: 0, added: 0, removed: 0, clean: true, unavailable: false }
    const unavailable: DiffSummary = { agentId: 'a6', files: 0, added: 0, removed: 0, clean: false, unavailable: true }

    expect(formatDiffSummary(changed)).toBe('4 ไฟล์ · +112 -29')
    expect(formatDiffSummary(clean)).toBe('ไม่มีไฟล์แก้')
    expect(formatDiffSummary(unavailable)).toBeNull()
    expect(formatDiffSummary(undefined)).toBeNull()
  })
})

describe('summary indexing helpers', () => {
  test('indexes summaries by agentId and builds stable id keys', () => {
    const s1: DiffSummary = { agentId: 'a7', files: 4, added: 112, removed: 29, clean: false, unavailable: false }
    const s2: DiffSummary = { agentId: 'a8', files: 0, added: 0, removed: 0, clean: true, unavailable: false }
    const map = indexDiffSummaries([s1, s2])
    expect(map.get('a7')).toEqual(s1)
    expect(map.get('a8')).toEqual(s2)

    const agents = [{ id: 'a7' }, { id: 'a8' }] as OfficeAgent[]
    expect(summaryIdsKey(agents)).toBe('a7,a8')
    expect(summaryIdsKey([])).toBe('')
  })
})
