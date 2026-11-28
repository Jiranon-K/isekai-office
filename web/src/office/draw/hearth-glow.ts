import type { RoomRect } from '../scene/hotspots'
import { fill } from './draw'
import type { OfficePalette } from './palette'
import type { HearthTone } from '../scene/hearth-alert'

const PAD = 4
const PULSE_RATE = 2
const RESTING_ALPHA = 0.5
const PULSE_BASE = 0.3
const PULSE_SWING = 0.3

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
  const alpha = animate ? PULSE_BASE + PULSE_SWING * (0.5 + 0.5 * Math.sin(seconds * PULSE_RATE)) : RESTING_ALPHA
  context.globalAlpha = alpha
  fill(context, palette, 'alert-blocked', Math.round(box.x) - PAD, Math.round(box.y) - PAD, Math.round(box.width) + PAD * 2, Math.round(box.height) + PAD * 2)
  context.globalAlpha = 1
}
