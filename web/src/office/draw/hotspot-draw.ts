import { fill } from './draw'
import { HOTSPOTS, labelAlpha, outlineAlpha, type HotspotView, type RoomRect } from '../scene/hotspots'
import { drawHotspotLabel } from './labels'
import { ROOM_HEIGHT } from '../scene/layout'
import type { ColorName, OfficePalette } from './palette'
import type { ViewMetrics } from '../scene/view'

const WEIGHT = 2
const MAX_ARM = 9
const DASH_STEP = 6
const LABEL_GAP = 3
const LABEL_LIFT = 10
const LABEL_FLOOR = ROOM_HEIGHT - 24
const MARKER_ROWS = [5, 3, 1]
const MARKER_LIFT = 6

type Box = { left: number; top: number; right: number; bottom: number }

function toBox(rect: RoomRect, shift: number): Box {
  const left = Math.round(rect.x) + shift
  const top = Math.round(rect.y) + shift
  return { left, top, right: left + Math.round(rect.width), bottom: top + Math.round(rect.height) }
}

function drawCorners(context: CanvasRenderingContext2D, palette: OfficePalette, color: ColorName, box: Box, arm: number): void {
  for (const x of [box.left, box.right - arm]) {
    fill(context, palette, color, x, box.top, arm, WEIGHT)
    fill(context, palette, color, x, box.bottom - WEIGHT, arm, WEIGHT)
  }
  for (const y of [box.top, box.bottom - arm]) {
    fill(context, palette, color, box.left, y, WEIGHT, arm)
    fill(context, palette, color, box.right - WEIGHT, y, WEIGHT, arm)
  }
}

function drawDashes(context: CanvasRenderingContext2D, palette: OfficePalette, color: ColorName, box: Box, arm: number): void {
  for (let x = box.left + arm + DASH_STEP; x <= box.right - arm - DASH_STEP; x += DASH_STEP * 2) {
    fill(context, palette, color, x, box.top, 2, 1)
    fill(context, palette, color, x, box.bottom - 1, 2, 1)
  }
}

function drawBracket(context: CanvasRenderingContext2D, palette: OfficePalette, rect: RoomRect): void {
  const arm = Math.min(MAX_ARM, Math.floor(Math.min(rect.width, rect.height) / 3))
  for (const [color, shift] of [['ink', 1], ['accent', 0]] as const) {
    const box = toBox(rect, shift)
    drawCorners(context, palette, color, box, arm)
    drawDashes(context, palette, color, box, arm)
  }
}

function drawMarker(context: CanvasRenderingContext2D, palette: OfficePalette, rect: RoomRect, bob: number): void {
  const centre = Math.round(rect.x + rect.width / 2)
  const top = Math.max(1, Math.round(rect.y) - MARKER_LIFT) + bob
  MARKER_ROWS.forEach((width, row) => {
    const half = (width - 1) / 2
    fill(context, palette, 'ink', centre - half - 1, top + row, width + 2, 2)
  })
  MARKER_ROWS.forEach((width, row) => {
    fill(context, palette, 'accent', centre - (width - 1) / 2, top + row, width, 1)
  })
}

export function drawHotspotMarkers(context: CanvasRenderingContext2D, palette: OfficePalette, seconds: number): void {
  HOTSPOTS.forEach((hotspot, index) => {
    const bob = Math.sin(seconds * 3 + index) > 0.3 ? -1 : 0
    hotspot.rects.forEach((rect) => drawMarker(context, palette, rect, bob))
  })
}

export function drawHotspotOutlines(context: CanvasRenderingContext2D, palette: OfficePalette, view: HotspotView): void {
  for (const hotspot of HOTSPOTS) {
    const alpha = outlineAlpha(view, hotspot.id)
    if (alpha <= 0) {
      continue
    }
    context.globalAlpha = alpha
    hotspot.rects.forEach((rect) => drawBracket(context, palette, rect))
  }
  context.globalAlpha = 1
}

function labelPoint(bounds: RoomRect): { x: number; y: number } {
  const bottom = bounds.y + bounds.height
  const y = bottom > LABEL_FLOOR ? bounds.y - LABEL_LIFT : bottom + LABEL_GAP
  return { x: bounds.x + bounds.width / 2, y }
}

export function drawHotspotLabels(
  context: CanvasRenderingContext2D,
  palette: OfficePalette,
  metrics: ViewMetrics,
  view: HotspotView,
): void {
  for (const hotspot of HOTSPOTS) {
    const alpha = labelAlpha(view, hotspot.id)
    if (alpha <= 0) {
      continue
    }
    const anchor = hotspot.rects[0]
    if (!anchor) {
      continue
    }
    const point = labelPoint(anchor)
    context.globalAlpha = alpha
    drawHotspotLabel(context, palette, metrics, hotspot.label, point.x, point.y)
  }
  context.globalAlpha = 1
}
