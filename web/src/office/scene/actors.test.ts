import { describe, expect, test } from 'bun:test'
import type { OfficeAgent } from '@shared/types'
import { createWalkGrid } from './layout'
import { createNpcActors, markConflicts, syncActors } from './actors'

function agent(id: string, state: OfficeAgent['state'], tool: string | null): OfficeAgent {
  return {
    id,
    title: id,
    repo: null,
    workspace: null,
    worktree: null,
    session: null,
    contextTokens: null,
    state,
    tool,
    lastMessage: null,
    updatedAt: 0,
    activeAt: 0,
    terminal: null
  }
}

describe('syncActors groupOf', () => {
  const grid = createWalkGrid()

  test('places by the tool and state when no groupOf is given', () => {
    const actors = createNpcActors()
    syncActors(actors, [agent('a', 'working', 'Read'), agent('b', 'waiting', null)], grid, true, 1000)
    expect(actors.get('a')?.groupId).toBe('archive')
    expect(actors.get('b')?.groupId).toBe('queue')
  })

  test('lets groupOf override the default', () => {
    const actors = createNpcActors()
    syncActors(actors, [agent('a', 'working', 'Read')], grid, true, 1000, () => 'crystal')
    expect(actors.get('a')?.groupId).toBe('crystal')
  })

  test('moves an actor when groupOf answers differently on the next sync', () => {
    const actors = createNpcActors()
    syncActors(actors, [agent('a', 'working', null)], grid, true, 1000, () => 'desk')
    syncActors(actors, [agent('a', 'working', null)], grid, true, 1000, () => 'forge')
    expect(actors.get('a')?.groupId).toBe('forge')
  })
})

describe('markConflicts', () => {
  const grid = createWalkGrid()

  test('marks matching agents in conflict and clears others', () => {
    const actors = createNpcActors()
    syncActors(actors, [agent('a1', 'working', 'Edit'), agent('a2', 'working', 'Write'), agent('a3', 'done', null)], grid, true, 1000)
    markConflicts(actors, new Set(['a1', 'a2']))
    expect(actors.get('a1')?.inConflict).toBe(true)
    expect(actors.get('a2')?.inConflict).toBe(true)
    expect(actors.get('a3')?.inConflict).toBe(false)
    markConflicts(actors, new Set(['a2']))
    expect(actors.get('a1')?.inConflict).toBe(false)
    expect(actors.get('a2')?.inConflict).toBe(true)
  })

  test('never marks NPC actors as in conflict', () => {
    const actors = createNpcActors()
    markConflicts(actors, new Set(['npc:bartender', 'npc:receptionist']))
    expect(actors.get('npc:bartender')?.inConflict).toBe(false)
    expect(actors.get('npc:receptionist')?.inConflict).toBe(false)
  })

  test('clears all conflict flags when conflictIds is omitted', () => {
    const actors = createNpcActors()
    syncActors(actors, [agent('a1', 'working', 'Edit')], grid, true, 1000)
    markConflicts(actors, new Set(['a1']))
    expect(actors.get('a1')?.inConflict).toBe(true)
    markConflicts(actors)
    expect(actors.get('a1')?.inConflict).toBe(false)
  })
})
