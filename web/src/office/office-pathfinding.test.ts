import { describe, expect, test } from 'bun:test'
import { DOOR_ENTRY, createWalkGrid } from './office-layout'
import { findPath, isWalkable, tileIndex, type TilePoint, type WalkGrid } from './office-pathfinding'
import { SPOT_GROUPS } from './office-stations'

function gridFrom(rows: readonly string[]): WalkGrid {
  const grid: WalkGrid = { columns: rows[0]?.length ?? 0, rows: rows.length, blocked: new Set<number>() }
  const blocked = new Set<number>()
  rows.forEach((line, y) => {
    Array.from(line).forEach((cell, x) => {
      if (cell === '#') {
        blocked.add(tileIndex(grid, x, y))
      }
    })
  })
  return { ...grid, blocked }
}

function cutsCorner(grid: WalkGrid, from: TilePoint, to: TilePoint): boolean {
  const diagonal = from.x !== to.x && from.y !== to.y
  return diagonal && (!isWalkable(grid, to.x, from.y) || !isWalkable(grid, from.x, to.y))
}

function corners(grid: WalkGrid, start: TilePoint, path: readonly TilePoint[]): number {
  return path.reduce((count, tile, index) => {
    const previous = index === 0 ? start : path[index - 1]
    return previous && cutsCorner(grid, previous, tile) ? count + 1 : count
  }, 0)
}

describe('findPath', () => {
  test('goes around a wall instead of cutting its corner', () => {
    const grid = gridFrom(['....', '.##.', '....'])
    const start = { x: 0, y: 0 }
    const path = findPath(grid, start, { x: 3, y: 2 })
    expect(path && corners(grid, start, path)).toBe(0)
  })

  test('refuses to squeeze between two diagonal blocks', () => {
    const grid = gridFrom(['.#', '#.'])
    expect(findPath(grid, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull()
  })

  test('returns an empty path when already at the goal', () => {
    const grid = gridFrom(['..'])
    expect(findPath(grid, { x: 0, y: 0 }, { x: 0, y: 0 })).toEqual([])
  })

  test('never cuts a corner on the real room from the door to any spot', () => {
    const grid = createWalkGrid()
    const total = Object.values(SPOT_GROUPS)
      .flat()
      .reduce((count, spot) => {
        const path = findPath(grid, DOOR_ENTRY, spot)
        return count + (path ? corners(grid, DOOR_ENTRY, path) : 1)
      }, 0)
    expect(total).toBe(0)
  })
})
