import { tileIndex, type TilePoint, type WalkGrid } from './pathfinding'

export const TILE_SIZE = 16
export const GRID_COLUMNS = 40
export const GRID_ROWS = 24
export const ROOM_WIDTH = GRID_COLUMNS * TILE_SIZE
export const ROOM_HEIGHT = GRID_ROWS * TILE_SIZE
export const WALL_ROWS = 3

export type Facing = 'down' | 'left' | 'right' | 'up'
export type Spot = TilePoint & { facing: Facing; seated: boolean }

export type WallPropKind = 'window' | 'banner' | 'questBoard' | 'fireplace' | 'lantern' | 'door'
export type FloorPropKind =
  | 'rug'
  | 'bookshelves'
  | 'desk'
  | 'forge'
  | 'crystalTable'
  | 'receptionCounter'
  | 'barShelf'
  | 'barCounter'
  | 'table'
  | 'barrel'
  | 'plant'
  | 'stool'
  | 'lamp'
export type PropKind = WallPropKind | FloorPropKind

export type Prop = {
  kind: PropKind
  x: number
  y: number
  width: number
  height: number
  blocks: boolean
}

export type Light = { x: number; y: number; radius: number }

export const DOOR_COLUMNS: readonly number[] = [19, 20]
export const DOOR_ENTRY: TilePoint = { x: 19, y: 23 }

export const NPC_SPOTS: Record<'bartender' | 'receptionist', Spot> = {
  bartender: { x: 29, y: 15, facing: 'down', seated: false },
  receptionist: { x: 19, y: 4, facing: 'down', seated: false },
}

function prop(kind: PropKind, x: number, y: number, width: number, height: number, blocks = true): Prop {
  return { kind, x, y, width, height, blocks }
}

function singles(kind: PropKind, points: readonly (readonly [number, number])[], blocks = true): Prop[] {
  return points.map(([x, y]) => prop(kind, x, y, 1, 1, blocks))
}

export const PROPS: readonly Prop[] = [
  prop('rug', 16, 6, 8, 4, false),
  prop('rug', 3, 14, 5, 4, false),
  prop('window', 3, 0, 2, 2, false),
  prop('window', 8, 0, 2, 2, false),
  prop('banner', 13, 0, 2, 3, false),
  prop('banner', 25, 0, 2, 3, false),
  prop('banner', 35, 0, 2, 3, false),
  prop('questBoard', 17, 0, 6, 3, false),
  prop('fireplace', 27, 0, 4, 4),
  prop('door', 19, 23, 2, 1, false),
  ...singles('lantern', [[15, 1], [23, 1]], false),
  prop('bookshelves', 2, 3, 10, 2),
  prop('forge', 31, 3, 8, 2),
  prop('desk', 2, 9, 8, 2),
  prop('crystalTable', 31, 9, 7, 2),
  prop('receptionCounter', 16, 5, 8, 1),
  prop('barShelf', 25, 13, 10, 2),
  prop('barCounter', 24, 16, 12, 1),
  ...singles('stool', [[25, 17], [27, 17], [29, 17], [31, 17], [33, 17], [35, 17]], false),
  prop('table', 4, 15, 3, 2),
  prop('table', 10, 18, 3, 2),
  prop('table', 14, 13, 3, 2),
  ...singles('barrel', [[1, 20], [1, 21], [2, 21], [37, 20], [38, 20], [38, 21]]),
  ...singles('plant', [[1, 3], [13, 3], [38, 6], [1, 13], [38, 14], [22, 21]]),
  ...singles('lamp', [[17, 22], [22, 22]]),
]

function light(tileX: number, tileY: number, radius: number): Light {
  return { x: tileX * TILE_SIZE, y: tileY * TILE_SIZE, radius }
}

export const LIGHTS: readonly Light[] = [
  light(29, 3.5, 120),
  light(34, 4.5, 92),
  light(34.5, 9.5, 76),
  light(15.5, 2, 72),
  light(23.5, 2, 72),
  light(17.5, 22, 64),
  light(22.5, 22, 64),
  light(30, 14, 92),
  light(5.5, 15.5, 52),
  light(11.5, 18.5, 52),
  light(15.5, 13.5, 52),
  light(7, 4.5, 64),
  light(6, 10, 56),
  light(20, 5, 76),
]

export function isDoorColumn(column: number): boolean {
  return DOOR_COLUMNS.includes(column)
}

function isWallTile(x: number, y: number): boolean {
  if (y < WALL_ROWS || x === 0 || x === GRID_COLUMNS - 1) {
    return true
  }
  return y === GRID_ROWS - 1 && !isDoorColumn(x)
}

export function createWalkGrid(): WalkGrid {
  const grid: WalkGrid = { columns: GRID_COLUMNS, rows: GRID_ROWS, blocked: new Set<number>() }
  const blocked = new Set<number>()
  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLUMNS; x += 1) {
      if (isWallTile(x, y)) {
        blocked.add(tileIndex(grid, x, y))
      }
    }
  }
  for (const item of PROPS) {
    if (!item.blocks) {
      continue
    }
    for (let y = item.y; y < item.y + item.height; y += 1) {
      for (let x = item.x; x < item.x + item.width; x += 1) {
        blocked.add(tileIndex(grid, x, y))
      }
    }
  }
  return { ...grid, blocked }
}
