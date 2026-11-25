import { createCanvas, fill, getContext, type Painter } from './office-draw'
import {
  GRID_COLUMNS,
  GRID_ROWS,
  LIGHTS,
  PROPS,
  ROOM_HEIGHT,
  ROOM_WIDTH,
  TILE_SIZE,
  WALL_ROWS,
  isDoorColumn,
  type Prop,
  type PropKind,
} from './office-layout'
import type { OfficePalette } from './office-palette'
import { FLOOR_PAINTERS } from './office-props'
import { WALL_PAINTERS } from './office-wall'

const WALL_HEIGHT = WALL_ROWS * TILE_SIZE
const PAINTERS: Record<PropKind, Painter> = { ...FLOOR_PAINTERS, ...WALL_PAINTERS }
const LIGHT_REACH = 0.62
const GLOW_REACH = 0.7
const CUT_ALPHA = 0.85
const TINT_ALPHA = 0.16

function paintFloor(context: CanvasRenderingContext2D, palette: OfficePalette): void {
  for (let row = WALL_ROWS; row < GRID_ROWS - 1; row += 1) {
    for (let column = 1; column < GRID_COLUMNS - 1; column += 1) {
      const x = column * TILE_SIZE
      const y = row * TILE_SIZE
      fill(context, palette, (row + column) % 2 === 0 ? 'floor-a' : 'floor-b', x, y, TILE_SIZE, TILE_SIZE)
      fill(context, palette, 'floor-line', x, y + TILE_SIZE - 1, TILE_SIZE, 1)
      fill(context, palette, 'floor-line', x + (row % 2) * 8, y, 1, TILE_SIZE)
    }
  }
}

function paintWalls(context: CanvasRenderingContext2D, palette: OfficePalette): void {
  fill(context, palette, 'wall-top', 0, 0, ROOM_WIDTH, 6)
  fill(context, palette, 'wall-face', 0, 6, ROOM_WIDTH, WALL_HEIGHT - 14)
  fill(context, palette, 'wall-base', 0, WALL_HEIGHT - 8, ROOM_WIDTH, 8)
  fill(context, palette, 'wall-line', 0, WALL_HEIGHT - 8, ROOM_WIDTH, 1)
  fill(context, palette, 'wall-line', 0, 22, ROOM_WIDTH, 1)
  for (let x = 0; x < ROOM_WIDTH; x += 32) {
    fill(context, palette, 'wall-line', x, 6, 1, 16)
    fill(context, palette, 'wall-line', x + 16, 23, 1, 17)
  }
  const sideHeight = ROOM_HEIGHT - WALL_HEIGHT
  fill(context, palette, 'wall-face', 0, WALL_HEIGHT, TILE_SIZE, sideHeight)
  fill(context, palette, 'wall-line', TILE_SIZE - 1, WALL_HEIGHT, 1, sideHeight)
  fill(context, palette, 'wall-face', ROOM_WIDTH - TILE_SIZE, WALL_HEIGHT, TILE_SIZE, sideHeight)
  fill(context, palette, 'wall-line', ROOM_WIDTH - TILE_SIZE, WALL_HEIGHT, 1, sideHeight)
  const bottomY = (GRID_ROWS - 1) * TILE_SIZE
  fill(context, palette, 'wall-face', 0, bottomY, ROOM_WIDTH, TILE_SIZE)
  fill(context, palette, 'wall-base', 0, bottomY + 8, ROOM_WIDTH, 8)
  fill(context, palette, 'wall-line', 0, bottomY, ROOM_WIDTH, 1)
  fill(context, palette, 'shadow', TILE_SIZE, WALL_HEIGHT, ROOM_WIDTH - TILE_SIZE * 2, 4)
  fill(context, palette, 'shadow', TILE_SIZE, WALL_HEIGHT, 3, sideHeight - TILE_SIZE)
  for (let column = 0; column < GRID_COLUMNS; column += 1) {
    if (isDoorColumn(column)) {
      fill(context, palette, 'floor-a', column * TILE_SIZE, bottomY, TILE_SIZE, TILE_SIZE)
    }
  }
}

const WALL_KINDS: ReadonlySet<PropKind> = new Set(['window', 'banner', 'questBoard', 'fireplace', 'lantern', 'door'])

function drawLayer(kind: PropKind): number {
  if (kind === 'rug') {
    return 0
  }
  return WALL_KINDS.has(kind) ? 1 : 2
}

function drawOrder(first: Prop, second: Prop): number {
  const layerGap = drawLayer(first.kind) - drawLayer(second.kind)
  return layerGap !== 0 ? layerGap : first.y + first.height - (second.y + second.height)
}

function paintProps(context: CanvasRenderingContext2D, palette: OfficePalette): void {
  for (const item of [...PROPS].sort(drawOrder)) {
    PAINTERS[item.kind](context, palette, {
      x: item.x * TILE_SIZE,
      y: item.y * TILE_SIZE,
      width: item.width * TILE_SIZE,
      height: item.height * TILE_SIZE,
    })
  }
}

export function buildRoomLayer(palette: OfficePalette): HTMLCanvasElement {
  const canvas = createCanvas(ROOM_WIDTH, ROOM_HEIGHT)
  const context = getContext(canvas)
  paintFloor(context, palette)
  paintWalls(context, palette)
  paintProps(context, palette)
  return canvas
}

export function buildShadeLayer(palette: OfficePalette): HTMLCanvasElement {
  const canvas = createCanvas(ROOM_WIDTH, ROOM_HEIGHT)
  const context = getContext(canvas)
  fill(context, palette, 'shade', 0, 0, ROOM_WIDTH, ROOM_HEIGHT)
  context.globalCompositeOperation = 'destination-out'
  context.globalAlpha = CUT_ALPHA
  for (const source of LIGHTS) {
    paintPool(context, palette.color('ink'), source.x, source.y, source.radius * LIGHT_REACH)
  }
  context.globalCompositeOperation = 'source-over'
  context.globalAlpha = TINT_ALPHA
  for (const source of LIGHTS) {
    paintPool(context, palette.color('glow'), source.x, source.y, source.radius * LIGHT_REACH * GLOW_REACH)
  }
  context.globalAlpha = 1
  return canvas
}

function paintPool(context: CanvasRenderingContext2D, color: string, x: number, y: number, radius: number): void {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, color)
  gradient.addColorStop(1, 'transparent')
  context.fillStyle = gradient
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}
