import type { RoomRect } from '../scene/hotspots'
import { fill } from './draw'
import type { OfficePalette } from './palette'
import type { HearthTone } from '../scene/hearth-alert'

const PAD = 4
const PULSE_RATE = 2
const RESTING_ALPHA = 0.7
const PULSE_BASE = 0.5
const PULSE_SWING = 0.35

export function hearthGlowAlpha(seconds: number, animate: boolean): number {
  if (!animate) {
    return RESTING_ALPHA
  }
  return PULSE_BASE + PULSE_SWING * (0.5 + 0.5 * Math.sin(seconds * PULSE_RATE))
}

export function drawHearthGlow(
  context: CanvasRenderingContext2D,
  palette: OfficePalette,
  box: RoomRect,
  tone: HearthTone,
  seconds: number,
  animate: boolean,
): void {
  if (tone !== 'red') {
    return
  }
  context.globalAlpha = hearthGlowAlpha(seconds, animate)
  fill(context, palette, 'alert-blocked', Math.round(box.x) - PAD, Math.round(box.y) - PAD, Math.round(box.width) + PAD * 2, Math.round(box.height) + PAD * 2)
  context.globalAlpha = 1
}
