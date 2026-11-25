import { describe, expect, test } from 'bun:test'
import { DOOR_ENTRY, NPC_SPOTS, createWalkGrid } from './office-layout'
import { findPath, isWalkable } from './office-pathfinding'
import { SPOT_GROUPS, groupForAgent, stationForTool } from './office-stations'

const grid = createWalkGrid()

describe('office layout reachability', () => {
  test('every station, queue and bar spot is walkable and reachable from the door', () => {
    const unreachable = Object.entries(SPOT_GROUPS).flatMap(([group, spots]) =>
      spots
        .filter((spot) => !isWalkable(grid, spot.x, spot.y) || findPath(grid, DOOR_ENTRY, spot) === null)
        .map((spot) => `${group}:${spot.x},${spot.y}`),
    )
    expect(unreachable).toEqual([])
  })

  test('every NPC spot is reachable from the door', () => {
    const unreachable = Object.entries(NPC_SPOTS).filter(([, spot]) => findPath(grid, DOOR_ENTRY, spot) === null)
    expect(unreachable).toEqual([])
  })

  test('the room counters block walking', () => {
    expect(isWalkable(grid, 20, 5)).toBe(false)
    expect(isWalkable(grid, 28, 16)).toBe(false)
  })
})

describe('station choice', () => {
  test('writing tools go to the desk', () => {
    expect(stationForTool('MultiEdit')).toBe('desk')
  })

  test('reading tools go to the archive', () => {
    expect(stationForTool('Grep')).toBe('archive')
  })

  test('research and workspace tools go to the crystal ball', () => {
    expect(stationForTool('mcp__team-workspace__get_task')).toBe('crystal')
    expect(stationForTool('mcp__claude_ai_Gmail__search_threads')).toBe('crystal')
    expect(stationForTool('WebSearch')).toBe('crystal')
  })

  test('shell, browser, database, unknown and missing tools go to the forge', () => {
    expect(stationForTool('Bash')).toBe('forge')
    expect(stationForTool('mcp__claude-in-chrome__navigate')).toBe('forge')
    expect(stationForTool('mcp__tidb-dev__db_query')).toBe('forge')
    expect(stationForTool('SomethingNew')).toBe('forge')
    expect(stationForTool(null)).toBe('forge')
  })

  test('agent state picks the group', () => {
    expect(groupForAgent({ state: 'done', tool: 'Bash' })).toBe('bar')
    expect(groupForAgent({ state: 'blocked', tool: null })).toBe('queue')
    expect(groupForAgent({ state: 'waiting', tool: null })).toBe('queue')
    expect(groupForAgent({ state: 'working', tool: 'Read' })).toBe('archive')
  })
})
