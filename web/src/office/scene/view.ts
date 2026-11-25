import { ROOM_HEIGHT, ROOM_WIDTH } from './layout'

export type ViewMetrics = {
  width: number
  height: number
  dpr: number
  scale: number
  offsetX: number
  offsetY: number
}

export const ROOM_ASPECT = ROOM_WIDTH / ROOM_HEIGHT

export function computeView(cssWidth: number, cssHeight: number, dpr: number): ViewMetrics {
  const width = Math.max(1, Math.round(cssWidth * dpr))
  const height = Math.max(1, Math.round(cssHeight * dpr))
  const scale = Math.min(width / ROOM_WIDTH, height / ROOM_HEIGHT)
  return {
    width,
    height,
    dpr,
    scale,
    offsetX: Math.round((width - ROOM_WIDTH * scale) / 2),
    offsetY: Math.round((height - ROOM_HEIGHT * scale) / 2),
  }
}

export function toRoomPoint(view: ViewMetrics, deviceX: number, deviceY: number): { x: number; y: number } {
  return { x: (deviceX - view.offsetX) / view.scale, y: (deviceY - view.offsetY) / view.scale }
}

export function toScreenPoint(view: ViewMetrics, roomX: number, roomY: number): { x: number; y: number } {
  return { x: view.offsetX + roomX * view.scale, y: view.offsetY + roomY * view.scale }
}

export type ScreenBox = { left: number; top: number; width: number; height: number }

function clamp(value: number, limit: number): number {
  return Math.min(Math.max(value, 0), limit)
}

export function toScreenBox(view: ViewMetrics, rect: { x: number; y: number; width: number; height: number }): ScreenBox {
  const start = toScreenPoint(view, rect.x, rect.y)
  const end = toScreenPoint(view, rect.x + rect.width, rect.y + rect.height)
  const left = clamp(start.x, view.width) / view.dpr
  const top = clamp(start.y, view.height) / view.dpr
  return { left, top, width: clamp(end.x, view.width) / view.dpr - left, height: clamp(end.y, view.height) / view.dpr - top }
}

export function canvasHeight(viewportWidth: number, viewportHeight: number): number {
  return Math.max(viewportHeight, viewportWidth / ROOM_ASPECT)
}

export function scrollToShow(box: ScreenBox, scrollTop: number, viewportHeight: number): number {
  const visible = box.top >= scrollTop && box.top + box.height <= scrollTop + viewportHeight
  if (visible) {
    return scrollTop
  }
  return Math.max(0, box.top + box.height / 2 - viewportHeight / 2)
}
