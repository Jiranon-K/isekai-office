import { TILE_SIZE } from './layout'

export type RoomRect = { x: number; y: number; width: number; height: number }

export type HotspotId = 'questBoard' | 'reception' | 'windows' | 'door' | 'orb' | 'barShelf' | 'hearth' | 'archive'

export type HotspotAction = { kind: 'panel' } | { kind: 'toggleMode' }

export type Hotspot = {
  id: HotspotId
  label: string
  hint: string
  rects: readonly RoomRect[]
  action: HotspotAction
}

export type PickTarget = { kind: 'agent'; id: string } | { kind: 'hotspot'; id: HotspotId }

export type HotspotView = {
  hoveredId: HotspotId | null
  openId: HotspotId | null
  revealAll: boolean
  pulse: number
}

export const PULSE_MS = 2400
export const REST_ALPHA = 0.38
export const AGENT_HALF_WIDTH = 9
export const AGENT_HEIGHT = 26
const OPEN_ALPHA = 0.85
const PANEL: HotspotAction = { kind: 'panel' }

function tiles(x: number, y: number, width: number, height: number): RoomRect {
  return { x: x * TILE_SIZE, y: y * TILE_SIZE, width: width * TILE_SIZE, height: height * TILE_SIZE }
}

export const HOTSPOTS: readonly Hotspot[] = [
  { id: 'questBoard', label: 'กระดานเควสต์', hint: 'การ์ดงาน งานที่รอคุณ และรอบ release', rects: [tiles(17, 0, 6, 3)], action: PANEL },
  { id: 'reception', label: 'แผนกต้อนรับ', hint: 'รายชื่อ session ทั้งหมดและใครรอคุณ', rects: [tiles(16, 3.4, 8, 2.7)], action: PANEL },
  {
    id: 'windows',
    label: 'หน้าต่าง',
    hint: 'สลับกลางวันกับกลางคืน',
    rects: [tiles(3, 0.2, 2, 1.8), tiles(8, 0.2, 2, 1.8)],
    action: { kind: 'toggleMode' },
  },
  { id: 'door', label: 'ประตู', hint: 'เรียกคนใหม่และเลือกโลก', rects: [tiles(17.9, 21.6, 4.2, 2.4)], action: PANEL },
  { id: 'orb', label: 'ลูกแก้ว', hint: 'context load ของทุก session', rects: [tiles(31.5, 8.2, 6, 2.6)], action: PANEL },
  {
    id: 'barShelf',
    label: 'ชั้นบาร์',
    hint: 'session ที่เสร็จแล้วและ MR ที่รอ verify',
    rects: [tiles(24.9, 11.5, 10.3, 4.5)],
    action: PANEL,
  },
  { id: 'hearth', label: 'เตาผิง', hint: 'สถานะ server, แหล่งข้อมูล และบันทึกของกิลด์', rects: [tiles(27, 0, 4, 3.4)], action: PANEL },
  { id: 'archive', label: 'ชั้นหนังสือ', hint: 'ประวัติงานใน Loop', rects: [tiles(1.9, 2.05, 10.2, 3.05)], action: PANEL },
]

function contains(rect: RoomRect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
}

export function agentHitRect(x: number, y: number): RoomRect {
  return { x: x - AGENT_HALF_WIDTH, y: y - AGENT_HEIGHT, width: AGENT_HALF_WIDTH * 2, height: AGENT_HEIGHT }
}

export function hotspotById(id: HotspotId): Hotspot {
  const found = HOTSPOTS.find((hotspot) => hotspot.id === id)
  if (!found) {
    throw new Error(`unknown hotspot ${id}`)
  }
  return found
}

export function hotspotAt(x: number, y: number): Hotspot | null {
  return HOTSPOTS.find((hotspot) => hotspot.rects.some((rect) => contains(rect, x, y))) ?? null
}

export function resolvePick(agentId: string | null, x: number, y: number): PickTarget | null {
  if (agentId !== null) {
    return { kind: 'agent', id: agentId }
  }
  const hotspot = hotspotAt(x, y)
  return hotspot ? { kind: 'hotspot', id: hotspot.id } : null
}

export function hotspotBounds(hotspot: Hotspot): RoomRect {
  const left = Math.min(...hotspot.rects.map((rect) => rect.x))
  const top = Math.min(...hotspot.rects.map((rect) => rect.y))
  const right = Math.max(...hotspot.rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...hotspot.rects.map((rect) => rect.y + rect.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function pulseAlpha(start: number | null, now: number, animate: boolean): number {
  if (start === null) {
    return 0
  }
  const progress = (now - start) / PULSE_MS
  if (progress < 0 || progress >= 1) {
    return 0
  }
  return animate ? Math.sin(Math.PI * progress) : 1
}

export function outlineAlpha(view: HotspotView, id: HotspotId): number {
  if (view.revealAll || view.hoveredId === id) {
    return 1
  }
  return Math.max(REST_ALPHA, view.pulse, view.openId === id ? OPEN_ALPHA : 0)
}

export function labelAlpha(view: HotspotView, id: HotspotId): number {
  if (view.revealAll || view.hoveredId === id) {
    return 1
  }
  return view.pulse
}
