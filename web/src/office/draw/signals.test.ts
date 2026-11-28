import { describe, expect, test } from 'bun:test'
import { WORLD_ANCHORS } from '../scene/anchors'
import type { OfficePalette } from './palette'
import { drawSignals, orbConflictRingState } from './signals'

type RectCall = { color: string; x: number; y: number; width: number; height: number; alpha: number }

function createRecorder(): { context: CanvasRenderingContext2D; rects: RectCall[] } {
  const rects: RectCall[] = []
  const recorder = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect(x: number, y: number, width: number, height: number) {
      rects.push({ color: String(this.fillStyle), x, y, width, height, alpha: this.globalAlpha })
    },
  }
  return { context: recorder as unknown as CanvasRenderingContext2D, rects }
}

const PALETTE: OfficePalette = {
  color: (name) => name,
  font: 'monospace',
}

describe('orbConflictRingState', () => {
  test('stays outside orb core and remains visible at seconds = 0', () => {
    const rest = orbConflictRingState(6, 0)
    expect(rest.radius).toBeGreaterThan(9)
    expect(rest.ringAlpha).toBeGreaterThan(0.4)
    expect(rest.glintAlpha).toBeGreaterThan(0.5)
  })

  test('expands by one pixel at peak pulse', () => {
    const trough = orbConflictRingState(7, (3 * Math.PI) / 8)
    const peak = orbConflictRingState(7, Math.PI / 8)
    expect(peak.radius).toBe(trough.radius + 1)
    expect(peak.ringAlpha).toBeGreaterThan(trough.ringAlpha)
  })
})

describe('drawSignals conflict ring', () => {
  test('draws warning ring and four glints around orb when conflictCount > 0', () => {
    const { context, rects } = createRecorder()
    drawSignals(
      context,
      PALETTE,
      WORLD_ANCHORS.tavern,
      { needsYou: 0, boardWaiting: 0, peakLoad: null, sourceReady: true, conflictCount: 2 },
      0,
    )
    expect(rects.some((rect) => rect.color === 'alert-blocked')).toBe(true)
    expect(rects.filter((rect) => rect.color === 'alert-waiting').length).toBe(4)
  })

  test('draws nothing around orb when conflictCount is 0 or omitted', () => {
    const zero = createRecorder()
    drawSignals(
      zero.context,
      PALETTE,
      WORLD_ANCHORS.tavern,
      { needsYou: 0, boardWaiting: 0, peakLoad: null, sourceReady: true, conflictCount: 0 },
      0,
    )
    expect(zero.rects.length).toBe(0)

    const omitted = createRecorder()
    drawSignals(
      omitted.context,
      PALETTE,
      WORLD_ANCHORS.tavern,
      { needsYou: 0, boardWaiting: 0, peakLoad: null, sourceReady: true },
      0,
    )
    expect(omitted.rects.length).toBe(0)
  })
})
