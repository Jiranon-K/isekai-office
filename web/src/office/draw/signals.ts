import { RECEPTION_BUBBLE, type WorldAnchors } from '../scene/anchors'
import { fill, fillDisc } from './draw'
import type { RoomRect } from '../scene/hotspots'
import { manaColor } from '../scene/mana'
import type { OfficePalette } from './palette'

export type Signals = {
  needsYou: number
  boardWaiting: number
  peakLoad: number | null
  sourceReady: boolean
}

const DIGITS: readonly (readonly number[])[] = [
  [7, 5, 5, 5, 7],
  [2, 6, 2, 2, 7],
  [7, 1, 7, 4, 7],
  [7, 1, 7, 1, 7],
  [5, 5, 7, 1, 1],
  [7, 4, 7, 1, 7],
  [7, 4, 7, 5, 7],
  [7, 1, 1, 1, 1],
  [7, 5, 7, 5, 7],
  [7, 5, 7, 1, 7],
]
const DIGIT_WIDTH = 4
const MAX_COUNT = 99

function drawDigit(context: CanvasRenderingContext2D, palette: OfficePalette, digit: number, x: number, y: number): void {
  const rows = DIGITS[digit] ?? []
  rows.forEach((bits, row) => {
    for (let column = 0; column < 3; column += 1) {
      if (bits & (4 >> column)) {
        fill(context, palette, 'ink', x + column, y + row, 1, 1)
      }
    }
  })
}

function drawCountBubble(context: CanvasRenderingContext2D, palette: OfficePalette, count: number, seconds: number): void {
  const digits = Array.from(String(Math.min(count, MAX_COUNT)), Number)
  const width = 8 + digits.length * DIGIT_WIDTH
  const bounce = Math.round(Math.abs(Math.sin(seconds * 4)) * 2)
  const x = RECEPTION_BUBBLE.x - Math.floor(width / 2)
  const y = RECEPTION_BUBBLE.y - bounce
  fill(context, palette, 'bubble-edge', x, y, width, 11)
  fill(context, palette, 'bubble', x + 1, y + 1, width - 2, 9)
  fill(context, palette, 'bubble-edge', RECEPTION_BUBBLE.x - 1, y + 11, 3, 2)
  fill(context, palette, 'alert-blocked', x + 3, y + 3, 1, 3)
  fill(context, palette, 'alert-blocked', x + 3, y + 7, 1, 1)
  digits.forEach((digit, index) => drawDigit(context, palette, digit, x + 6 + index * DIGIT_WIDTH, y + 3))
}

function drawNotesGlow(context: CanvasRenderingContext2D, palette: OfficePalette, notes: RoomRect, seconds: number): void {
  const pulse = (Math.sin(seconds * 3) + 1) / 2
  context.globalAlpha = 0.12 + 0.2 * pulse
  fill(context, palette, 'glow', notes.x - 2, notes.y - 2, notes.width + 4, notes.height + 4)
  context.globalAlpha = 0.16 + 0.24 * pulse
  fill(context, palette, 'fire-core', notes.x, notes.y, notes.width, notes.height)
  context.globalAlpha = 0.5 + 0.5 * pulse
  for (const [x, y] of [[notes.x - 2, notes.y - 2], [notes.x + notes.width, notes.y - 2], [notes.x - 2, notes.y + notes.height], [notes.x + notes.width, notes.y + notes.height]] as const) {
    fill(context, palette, 'fire-core', x, y, 2, 2)
  }
  context.globalAlpha = 1
}

function drawOrbTint(context: CanvasRenderingContext2D, palette: OfficePalette, orb: WorldAnchors['orb'], load: number): void {
  const color = manaColor(load)
  context.globalAlpha = 0.22
  fillDisc(context, palette, color, orb.x, orb.y, orb.radius + 3)
  context.globalAlpha = 0.6
  fillDisc(context, palette, color, orb.x, orb.y, orb.radius)
  context.globalAlpha = 0.9
  fill(context, palette, 'paper', orb.x - Math.ceil(orb.radius / 2), orb.y - Math.ceil(orb.radius / 2), 1, 1)
  context.globalAlpha = 1
}

function drawEmbers(context: CanvasRenderingContext2D, palette: OfficePalette, firebox: RoomRect, seconds: number): void {
  context.globalAlpha = 0.88
  fill(context, palette, 'ink', firebox.x, firebox.y, firebox.width, firebox.height)
  const tick = Math.floor(seconds * 3)
  const floor = firebox.y + firebox.height
  for (let column = 2; column < firebox.width - 2; column += 3) {
    const lit = (tick + column * 7) % 5
    context.globalAlpha = 0.45 + 0.11 * lit
    fill(context, palette, lit > 2 ? 'ember' : 'fire-b', firebox.x + column, floor - 2 - (column % 2), 2, 1)
    fill(context, palette, 'fire-b', firebox.x + column - 1, floor - 1, 3, 1)
  }
  context.globalAlpha = 1
}

export function drawSignals(
  context: CanvasRenderingContext2D,
  palette: OfficePalette,
  anchors: WorldAnchors,
  signals: Signals,
  seconds: number,
): void {
  if (!signals.sourceReady) {
    drawEmbers(context, palette, anchors.firebox, seconds)
  }
  if (signals.boardWaiting > 0) {
    drawNotesGlow(context, palette, anchors.notes, seconds)
  }
  if (signals.peakLoad !== null) {
    drawOrbTint(context, palette, anchors.orb, signals.peakLoad)
  }
  if (signals.needsYou > 0) {
    drawCountBubble(context, palette, signals.needsYou, seconds)
  }
}
