import { describe, expect, test } from 'bun:test'
import { conflictPipLayout, drawActorPlate } from './labels'
import type { OfficePalette } from './palette'
import type { Actor } from '../scene/actors'
import type { ViewMetrics } from '../scene/view'

type RectCall = { color: string; x: number; y: number; width: number; height: number }

function createRecorder(): { context: CanvasRenderingContext2D; rects: RectCall[] } {
  const rects: RectCall[] = []
  const recorder = {
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    fillStyle: '',
    measureText: (text: string) => ({ width: text.length * 8 }),
    fillRect(x: number, y: number, width: number, height: number) {
      rects.push({ color: String(this.fillStyle), x, y, width, height })
    },
    fillText() {},
  }
  return { context: recorder as unknown as CanvasRenderingContext2D, rects }
}

const PALETTE: OfficePalette = {
  color: (name) => name,
  font: 'monospace',
}

const VIEW: ViewMetrics = {
  width: 1280,
  height: 768,
  scale: 2,
  offsetX: 0,
  offsetY: 0,
  dpr: 1,
}

function makeActor(inConflict: boolean): Actor {
  return {
    id: 'a1',
    kind: 'agent',
    label: 'cart',
    repo: null,
    look: { characterClass: 'knight', skin: 1, hair: 1 },
    x: 100,
    y: 120,
    tile: { x: 6, y: 7 },
    facing: 'down',
    path: [],
    spot: null,
    groupId: 'desk',
    spotIndex: 0,
    state: 'working',
    mana: 0.4,
    quiet: false,
    inConflict,
    partyKey: null,
    partyColour: null,
    npcMode: 'idle',
    leaving: false,
    walked: 0,
    phase: 0,
  }
}

describe('conflictPipLayout', () => {
  test('places pip right of plate with exclamation inside bounds across scales', () => {
    const plate = { left: 100, top: 40, width: 60, height: 18 }
    for (const scale of [1, 2, 3, 4]) {
      const pip = conflictPipLayout(plate, scale)
      expect(pip.left - pip.border).toBeGreaterThan(plate.left + plate.width)
      expect(pip.barX).toBeGreaterThanOrEqual(pip.left)
      expect(pip.barX + pip.barWidth).toBeLessThanOrEqual(pip.left + pip.width)
      expect(pip.barY).toBeGreaterThanOrEqual(pip.top)
      expect(pip.dotY).toBeGreaterThan(pip.barY + pip.barHeight)
      expect(pip.dotY + pip.dotHeight).toBeLessThanOrEqual(pip.top + pip.height)
    }
  })
})

describe('drawActorPlate conflict pip', () => {
  test('draws outline, red badge, and exclamation mark when actor is in conflict', () => {
    const { context, rects } = createRecorder()
    drawActorPlate(context, PALETTE, VIEW, makeActor(true), false)
    expect(rects.some((rect) => rect.color === 'alert-blocked')).toBe(true)
    expect(rects.filter((rect) => rect.color === 'bubble').length).toBe(2)
    expect(rects.some((rect) => rect.color === 'outline')).toBe(true)
  })

  test('omits conflict pip when actor is not in conflict', () => {
    const { context, rects } = createRecorder()
    drawActorPlate(context, PALETTE, VIEW, makeActor(false), false)
    expect(rects.some((rect) => rect.color === 'alert-blocked')).toBe(false)
    expect(rects.some((rect) => rect.color === 'bubble')).toBe(false)
  })
})
