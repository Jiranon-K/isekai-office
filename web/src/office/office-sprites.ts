import { createCanvas, getContext } from './office-draw'
import { hashString } from './office-hash'
import type { Facing } from './office-layout'
import type { ColorName, OfficePalette } from './office-palette'

export const SPRITE_WIDTH = 18
export const SPRITE_HEIGHT = 26
export const SPRITE_ANCHOR_X = 9
export const SPRITE_ANCHOR_Y = 25
export const FRAME_COUNT = 6
export const FRAMES = { idle: 0, stepLeft: 1, mid: 2, stepRight: 3, workA: 4, workB: 5 }
export const WALK_CYCLE: readonly number[] = [FRAMES.stepLeft, FRAMES.mid, FRAMES.stepRight, FRAMES.mid]
export const FACING_ROWS: Record<Facing, number> = { down: 0, left: 1, right: 2, up: 3 }

export type CharacterClass = 'knight' | 'mage' | 'ranger' | 'alchemist' | 'bartender' | 'receptionist'
export type SkinTone = 1 | 2 | 3
export type HairTone = 1 | 2 | 3 | 4
export type Look = { characterClass: CharacterClass; skin: SkinTone; hair: HairTone }

type Part = readonly [number, number, number, number, ColorName]
type ArmPose = 'down' | 'swing' | 'raised'
type Pose = { liftLeft: boolean; liftRight: boolean; armLeft: ArmPose; armRight: ArmPose }

const ADVENTURER_CLASSES: readonly CharacterClass[] = ['knight', 'mage', 'ranger', 'alchemist']
const SKIN_TONES: readonly SkinTone[] = [1, 2, 3]
const HAIR_TONES: readonly HairTone[] = [1, 2, 3, 4]
const INNER_WIDTH = 16

const POSES: readonly Pose[] = [
  { liftLeft: false, liftRight: false, armLeft: 'down', armRight: 'down' },
  { liftLeft: true, liftRight: false, armLeft: 'down', armRight: 'swing' },
  { liftLeft: false, liftRight: false, armLeft: 'down', armRight: 'down' },
  { liftLeft: false, liftRight: true, armLeft: 'swing', armRight: 'down' },
  { liftLeft: false, liftRight: false, armLeft: 'down', armRight: 'raised' },
  { liftLeft: false, liftRight: false, armLeft: 'raised', armRight: 'down' },
]

export function lookFromId(id: string): Look {
  const hash = hashString(id)
  return {
    characterClass: ADVENTURER_CLASSES[hash % ADVENTURER_CLASSES.length] ?? 'knight',
    skin: SKIN_TONES[(hash >>> 3) % SKIN_TONES.length] ?? 1,
    hair: HAIR_TONES[(hash >>> 6) % HAIR_TONES.length] ?? 1,
  }
}

function tone(look: Look, part: 'body' | 'trim' | 'accent' | 'legs'): ColorName {
  return `${look.characterClass}-${part}`
}

function legParts(look: Look, pose: Pose, leftX: number, rightX: number, width: number): Part[] {
  const legs: Part[] = []
  const placements = [
    { x: leftX, lifted: pose.liftLeft },
    { x: rightX, lifted: pose.liftRight },
  ]
  for (const { x, lifted } of placements) {
    const length = lifted ? 4 : 5
    legs.push([x, 19, width, length, tone(look, 'legs')], [x, 19 + length - 2, width, 2, 'boots'])
  }
  return legs
}

function classDetail(look: Look, left: number, width: number): Part[] {
  const center = left + Math.floor(width / 2) - 1
  switch (look.characterClass) {
    case 'knight':
      return [[center, 12, 2, 4, tone(look, 'trim')]]
    case 'mage':
      return [
        [left - 1, 19, width + 2, 2, tone(look, 'body')],
        [left - 1, 20, width + 2, 1, tone(look, 'trim')],
      ]
    case 'ranger':
      return [
        [left - 1, 12, 1, 7, tone(look, 'accent')],
        [left + width, 12, 1, 7, tone(look, 'accent')],
      ]
    case 'alchemist':
      return [
        [left + 1, 12, 1, 5, tone(look, 'trim')],
        [left + width - 2, 17, 2, 2, 'crystal-a'],
      ]
    case 'bartender':
      return [[left + 1, 14, width - 2, 5, tone(look, 'trim')]]
    case 'receptionist':
      return [
        [left + 1, 12, width - 2, 1, tone(look, 'trim')],
        [center, 13, 2, 2, tone(look, 'accent')],
      ]
  }
}

function bodyParts(look: Look, narrow: boolean): Part[] {
  const left = narrow ? 5 : 4
  const width = narrow ? 6 : 8
  return [
    [left, 12, width, 7, tone(look, 'body')],
    [left, 16, width, 1, tone(look, 'trim')],
    ...classDetail(look, left, width),
  ]
}

function armParts(look: Look, x: number, pose: ArmPose): Part[] {
  const skin: ColorName = `skin-${look.skin}`
  if (pose === 'raised') {
    return [
      [x, 10, 2, 3, tone(look, 'trim')],
      [x, 8, 2, 2, skin],
    ]
  }
  const shift = pose === 'swing' ? 1 : 0
  return [
    [x, 12 + shift, 2, 4, tone(look, 'trim')],
    [x, 16 + shift, 2, 1, skin],
  ]
}

function headParts(look: Look, facing: Facing): Part[] {
  const skin: ColorName = `skin-${look.skin}`
  const hair: ColorName = `hair-${look.hair}`
  if (facing === 'up') {
    return [
      [4, 4, 8, 8, hair],
      [5, 11, 6, 1, skin],
    ]
  }
  if (facing === 'down') {
    return [
      [4, 4, 8, 8, skin],
      [4, 4, 8, 3, hair],
      [4, 7, 1, 3, hair],
      [11, 7, 1, 3, hair],
      [6, 8, 1, 2, 'outline'],
      [9, 8, 1, 2, 'outline'],
    ]
  }
  return [
    [5, 4, 7, 8, skin],
    [5, 4, 7, 3, hair],
    [5, 7, 2, 4, hair],
    [10, 8, 1, 2, 'outline'],
  ]
}

function gearParts(look: Look): Part[] {
  switch (look.characterClass) {
    case 'knight':
      return [
        [3, 3, 10, 4, tone(look, 'body')],
        [3, 6, 1, 4, tone(look, 'body')],
        [12, 6, 1, 4, tone(look, 'body')],
        [7, 0, 2, 3, tone(look, 'accent')],
      ]
    case 'mage':
      return [
        [2, 5, 12, 1, tone(look, 'accent')],
        [4, 3, 8, 2, tone(look, 'accent')],
        [6, 1, 4, 2, tone(look, 'accent')],
        [7, 0, 2, 1, tone(look, 'accent')],
        [4, 4, 8, 1, tone(look, 'trim')],
      ]
    case 'ranger':
      return [
        [3, 3, 10, 4, tone(look, 'accent')],
        [3, 7, 1, 5, tone(look, 'accent')],
        [12, 7, 1, 5, tone(look, 'accent')],
      ]
    case 'alchemist':
      return [
        [4, 6, 8, 1, tone(look, 'trim')],
        [5, 5, 2, 2, tone(look, 'accent')],
        [9, 5, 2, 2, tone(look, 'accent')],
      ]
    case 'bartender':
      return []
    case 'receptionist':
      return [
        [6, 2, 4, 2, `hair-${look.hair}`],
        [3, 4, 2, 2, tone(look, 'accent')],
      ]
  }
}

function buildParts(look: Look, facing: Facing, pose: Pose): Part[] {
  const narrow = facing === 'left' || facing === 'right'
  const legs = narrow ? legParts(look, pose, 6, 8, 2) : legParts(look, pose, 5, 8, 3)
  const arms = narrow
    ? armParts(look, 7, pose.armLeft === 'down' ? pose.armRight : pose.armLeft)
    : [...armParts(look, 2, pose.armLeft), ...armParts(look, 12, pose.armRight)]
  return [...legs, ...bodyParts(look, narrow), ...arms, ...headParts(look, facing), ...gearParts(look)]
}

function drawParts(context: CanvasRenderingContext2D, palette: OfficePalette, parts: Part[], mirror: boolean): void {
  for (const [x, y, width, height, color] of parts) {
    context.fillStyle = palette.color(color)
    const drawX = mirror ? INNER_WIDTH - x - width : x
    context.fillRect(drawX + 1, y + 1, width, height)
  }
}

function paintCell(
  sheetContext: CanvasRenderingContext2D,
  cell: HTMLCanvasElement,
  silhouette: HTMLCanvasElement,
  palette: OfficePalette,
  look: Look,
  facing: Facing,
  frame: number,
): void {
  const cellContext = getContext(cell)
  const silhouetteContext = getContext(silhouette)
  cellContext.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT)
  silhouetteContext.globalCompositeOperation = 'source-over'
  silhouetteContext.clearRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT)
  const pose = POSES[frame] ?? POSES[0]
  if (!pose) {
    return
  }
  const sourceFacing: Facing = facing === 'left' ? 'right' : facing
  drawParts(cellContext, palette, buildParts(look, sourceFacing, pose), facing === 'left')
  silhouetteContext.drawImage(cell, 0, 0)
  silhouetteContext.globalCompositeOperation = 'source-in'
  silhouetteContext.fillStyle = palette.color('outline')
  silhouetteContext.fillRect(0, 0, SPRITE_WIDTH, SPRITE_HEIGHT)
  const destinationX = frame * SPRITE_WIDTH
  const destinationY = FACING_ROWS[facing] * SPRITE_HEIGHT
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    sheetContext.drawImage(silhouette, destinationX + (dx ?? 0), destinationY + (dy ?? 0))
  }
  sheetContext.drawImage(cell, destinationX, destinationY)
}

function buildSheet(palette: OfficePalette, look: Look): HTMLCanvasElement {
  const sheet = createCanvas(SPRITE_WIDTH * FRAME_COUNT, SPRITE_HEIGHT * 4)
  const sheetContext = getContext(sheet)
  const cell = createCanvas(SPRITE_WIDTH, SPRITE_HEIGHT)
  const silhouette = createCanvas(SPRITE_WIDTH, SPRITE_HEIGHT)
  const facings: Facing[] = ['down', 'left', 'right', 'up']
  for (const facing of facings) {
    for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
      paintCell(sheetContext, cell, silhouette, palette, look, facing, frame)
    }
  }
  return sheet
}

const sheetCaches = new WeakMap<OfficePalette, Map<string, HTMLCanvasElement>>()

export function getSpriteSheet(palette: OfficePalette, look: Look): HTMLCanvasElement {
  const cache = sheetCaches.get(palette) ?? new Map<string, HTMLCanvasElement>()
  sheetCaches.set(palette, cache)
  const key = `${look.characterClass}-${look.skin}-${look.hair}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }
  const sheet = buildSheet(palette, look)
  cache.set(key, sheet)
  return sheet
}
