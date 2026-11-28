import { describe, expect, test } from 'bun:test'
import { detectConflicts, type AgentTouched } from './detect'

function touched(overrides: Partial<AgentTouched> & Pick<AgentTouched, 'agentId' | 'paths'>): AgentTouched {
  return {
    repo: 'web-app',
    worktree: '/repo/web-app',
    state: 'working',
    updatedAt: 1000,
    ...overrides
  }
}

describe('detectConflicts', () => {
  test('emits conflicts for 2 or more active agents sorted by updatedAt descending', () => {
    const conflicts = detectConflicts([
      touched({ agentId: 'a1', updatedAt: 100, paths: ['src/checkout/cart.ts', 'src/checkout/summary.tsx'] }),
      touched({ agentId: 'a2', state: 'waiting', updatedAt: 300, paths: ['src\\checkout\\CART.ts'] }),
      touched({ agentId: 'a5', state: 'blocked', updatedAt: 200, paths: ['./src/checkout/summary.tsx'] })
    ])
    expect(conflicts).toEqual([
      { repo: 'web-app', path: 'src/checkout/cart.ts', agentIds: ['a1', 'a2'], updatedAt: 300 },
      { repo: 'web-app', path: 'src/checkout/summary.tsx', agentIds: ['a1', 'a5'], updatedAt: 200 }
    ])
  })

  test('excludes done agents and ignores single-agent duplicate paths', () => {
    const conflicts = detectConflicts([
      touched({ agentId: 'a1', state: 'working', paths: ['src/a.ts', 'src/a.ts'] }),
      touched({ agentId: 'a7', state: 'done', paths: ['src/a.ts'] })
    ])
    expect(conflicts).toEqual([])
  })

  test('isolates identical relative paths across different repositories', () => {
    const conflicts = detectConflicts([
      touched({ agentId: 'a1', repo: 'web-app', paths: ['src/index.ts'] }),
      touched({ agentId: 'a3', repo: 'api', paths: ['src/index.ts'] }),
      touched({ agentId: 'a4', repo: null, worktree: '/repo/other', paths: ['src/index.ts'] }),
      touched({ agentId: 'a5', repo: null, worktree: '/repo/other', paths: ['src/index.ts'] })
    ])
    expect(conflicts).toEqual([
      { repo: '/repo/other', path: 'src/index.ts', agentIds: ['a4', 'a5'], updatedAt: 1000 }
    ])
  })
})
