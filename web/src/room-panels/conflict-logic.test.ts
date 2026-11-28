import { describe, expect, test } from 'bun:test'
import type { FileConflict } from '@shared/conflicts'
import type { OfficeAgent } from '@shared/types'
import {
  activeConflictAgentIds,
  classifyConflictView,
  conflictRevisionKey,
  conflictTabLabel,
  resolveConflictAgents
} from './conflict-logic'

function makeAgent(id: string, state: OfficeAgent['state'], updatedAt: number): OfficeAgent {
  return {
    id,
    title: `Task ${id}`,
    repo: 'web-app',
    workspace: 'main',
    worktree: null,
    session: null,
    contextTokens: 100_000,
    state,
    tool: null,
    lastMessage: null,
    updatedAt,
    activeAt: updatedAt,
    terminal: `term-${id}`
  }
}

describe('conflictRevisionKey', () => {
  test('ignores done agents and stays stable regardless of input order', () => {
    const a1 = makeAgent('a1', 'working', 100)
    const a2 = makeAgent('a2', 'waiting', 200)
    const a7 = makeAgent('a7', 'done', 300)

    expect(conflictRevisionKey([a2, a7, a1])).toBe('a1:100,a2:200')
    expect(conflictRevisionKey([a1, a2])).toBe('a1:100,a2:200')
    expect(conflictRevisionKey([a7])).toBe('')
  })

  test('changes when an active agent updatedAt changes', () => {
    const before = conflictRevisionKey([makeAgent('a1', 'working', 100)])
    const after = conflictRevisionKey([makeAgent('a1', 'working', 101)])
    expect(before).not.toBe(after)
  })
})

describe('activeConflictAgentIds', () => {
  test('collects unique conflict agent IDs present in current agents list', () => {
    const agents = [makeAgent('a1', 'working', 1), makeAgent('a2', 'working', 1), makeAgent('a5', 'waiting', 1)]
    const conflicts: FileConflict[] = [
      { repo: 'web-app', path: 'src/checkout/cart.ts', agentIds: ['a1', 'a2'], updatedAt: 2 },
      { repo: 'web-app', path: 'src/checkout/summary.tsx', agentIds: ['a1', 'a5', 'gone'], updatedAt: 1 }
    ]

    expect([...activeConflictAgentIds(conflicts, agents)].sort()).toEqual(['a1', 'a2', 'a5'])
    expect(activeConflictAgentIds([], agents).size).toBe(0)
  })
})

describe('conflictTabLabel', () => {
  test('appends count only when conflicts exist', () => {
    expect(conflictTabLabel(0)).toBe('ไฟล์ชนกัน')
    expect(conflictTabLabel(2)).toBe('ไฟล์ชนกัน (2)')
  })
})

describe('resolveConflictAgents', () => {
  test('resolves present agents in conflict order and omits missing IDs', () => {
    const a1 = makeAgent('a1', 'working', 1)
    const a5 = makeAgent('a5', 'waiting', 2)
    const agentsById = new Map<string, OfficeAgent>([
      ['a1', a1],
      ['a5', a5]
    ])
    const conflict: FileConflict = {
      repo: 'web-app',
      path: 'src/checkout/summary.tsx',
      agentIds: ['a5', 'missing', 'a1'],
      updatedAt: 2
    }

    expect(resolveConflictAgents(conflict, agentsById)).toEqual([a5, a1])
  })
})

describe('classifyConflictView', () => {
  const sample: FileConflict = { repo: 'web-app', path: 'src/a.ts', agentIds: ['a1', 'a2'], updatedAt: 1 }

  test('prioritizes error, then initial loading, then empty, then list', () => {
    expect(classifyConflictView([], false, 'conflicts_unavailable')).toBe('error')
    expect(classifyConflictView([sample], true, 'conflicts_unavailable')).toBe('error')
    expect(classifyConflictView([], true, null)).toBe('loading')
    expect(classifyConflictView([], false, null)).toBe('empty')
    expect(classifyConflictView([sample], true, null)).toBe('list')
    expect(classifyConflictView([sample], false, null)).toBe('list')
  })
})
