export type TilePoint = { x: number; y: number }

export type WalkGrid = {
  columns: number
  rows: number
  blocked: ReadonlySet<number>
}

type SearchNode = {
  x: number
  y: number
  cost: number
  score: number
  parent: SearchNode | null
}

const STEPS: readonly TilePoint[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
]

export function tileIndex(grid: WalkGrid, x: number, y: number): number {
  return y * grid.columns + x
}

export function isWalkable(grid: WalkGrid, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= grid.columns || y >= grid.rows) {
    return false
  }
  return !grid.blocked.has(tileIndex(grid, x, y))
}

export function canStep(grid: WalkGrid, from: TilePoint, step: TilePoint): boolean {
  if (!isWalkable(grid, from.x + step.x, from.y + step.y)) {
    return false
  }
  if (step.x === 0 || step.y === 0) {
    return true
  }
  return isWalkable(grid, from.x + step.x, from.y) && isWalkable(grid, from.x, from.y + step.y)
}

function estimate(from: TilePoint, to: TilePoint): number {
  const dx = Math.abs(from.x - to.x)
  const dy = Math.abs(from.y - to.y)
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)
}

function takeLowest(open: SearchNode[]): SearchNode | undefined {
  let lowestIndex = 0
  open.forEach((node, index) => {
    const lowest = open[lowestIndex]
    if (lowest && node.score < lowest.score) {
      lowestIndex = index
    }
  })
  return open.splice(lowestIndex, 1)[0]
}

function collectPath(goalNode: SearchNode): TilePoint[] {
  const path: TilePoint[] = []
  let node: SearchNode | null = goalNode
  while (node?.parent) {
    path.push({ x: node.x, y: node.y })
    node = node.parent
  }
  return path.reverse()
}

export function findPath(grid: WalkGrid, start: TilePoint, goal: TilePoint): TilePoint[] | null {
  if (!isWalkable(grid, start.x, start.y) || !isWalkable(grid, goal.x, goal.y)) {
    return null
  }
  const open: SearchNode[] = [{ ...start, cost: 0, score: estimate(start, goal), parent: null }]
  const bestCost = new Map<number, number>([[tileIndex(grid, start.x, start.y), 0]])
  const closed = new Set<number>()
  let current = takeLowest(open)
  while (current) {
    const currentIndex = tileIndex(grid, current.x, current.y)
    if (!closed.has(currentIndex)) {
      if (current.x === goal.x && current.y === goal.y) {
        return collectPath(current)
      }
      closed.add(currentIndex)
      for (const step of STEPS) {
        if (!canStep(grid, current, step)) {
          continue
        }
        const next = { x: current.x + step.x, y: current.y + step.y }
        const nextIndex = tileIndex(grid, next.x, next.y)
        const nextCost = current.cost + (step.x !== 0 && step.y !== 0 ? Math.SQRT2 : 1)
        const known = bestCost.get(nextIndex)
        if (closed.has(nextIndex) || (known !== undefined && known <= nextCost)) {
          continue
        }
        bestCost.set(nextIndex, nextCost)
        open.push({ ...next, cost: nextCost, score: nextCost + estimate(next, goal), parent: current })
      }
    }
    current = takeLowest(open)
  }
  return null
}
