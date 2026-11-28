import { stateLine } from '@/lib/state-duration'
import type { AgentState } from '@shared/types'
import type { Actor } from '../scene/actors'
import type { ViewMetrics } from '../scene/view'
import { drawPlate, plateHeight } from './labels'
import type { OfficePalette } from './palette'

const UNDER_BUBBLE_ROOM_Y = 24
const ABOVE_BUBBLE_ROOM_Y = 40

export type LabelPlacement = 'under-bubble' | 'above-head' | null

export function labelPlacement(state: AgentState, hovered: boolean): LabelPlacement {
  if (state === 'waiting') {
    return 'under-bubble'
  }
  return hovered ? 'above-head' : null
}

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
  const placement = labelPlacement(actor.state, hovered)
  if (placement === null) {
    return
  }
  const roomY = placement === 'above-head' ? actor.y - ABOVE_BUBBLE_ROOM_Y - plateHeight(view) / view.scale : actor.y - UNDER_BUBBLE_ROOM_Y
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
