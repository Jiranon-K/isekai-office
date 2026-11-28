import { stateLine } from '@/lib/state-duration'
import type { Actor } from '../scene/actors'
import type { ViewMetrics } from '../scene/view'
import { drawPlate, plateHeight } from './labels'
import type { OfficePalette } from './palette'

const UNDER_BUBBLE_ROOM_Y = 26
const ABOVE_BUBBLE_ROOM_Y = 40

export function drawStateLabel(
  context: CanvasRenderingContext2D,
  palette: OfficePalette,
  view: ViewMetrics,
  actor: Actor,
  now: number,
  hovered: boolean,
): void {
  if (actor.kind !== 'agent' || actor.state === null) {
    return
  }
  const waiting = actor.state === 'waiting'
  if (!hovered && !waiting) {
    return
  }
  const roomY = hovered ? actor.y - ABOVE_BUBBLE_ROOM_Y - plateHeight(view) / view.scale : actor.y - UNDER_BUBBLE_ROOM_Y
  drawPlate(context, palette, view, {
    text: stateLine(actor.state, actor.stateSince, now),
    roomX: actor.x,
    roomY,
    ratio: 1,
    textColor: 'accent',
    background: 'plate',
    weight: 500,
  })
}
