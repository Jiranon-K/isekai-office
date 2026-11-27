import { describe, expect, test } from 'bun:test'
import type { OfficeAgent } from '@shared/types'
import { createWalkGrid } from './layout'
import { syncActors, createNpcActors } from './actors'

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
