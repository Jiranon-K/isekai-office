import type { World } from '@/lib/theme'
import type { RoomRect } from './office-hotspots'

export type WorldAnchors = {
  orb: { x: number; y: number; radius: number }
  firebox: RoomRect
  notes: RoomRect
}

export const RECEPTION_BUBBLE = { x: 312, y: 40 }

export const WORLD_ANCHORS: Record<World, WorldAnchors> = {
  tavern: {
    orb: { x: 552, y: 152, radius: 7 },
    firebox: { x: 446, y: 31, width: 36, height: 22 },
    notes: { x: 280, y: 14, width: 80, height: 26 },
  },
  grove: {
    orb: { x: 567, y: 140, radius: 6 },
    firebox: { x: 448, y: 33, width: 32, height: 22 },
    notes: { x: 281, y: 9, width: 74, height: 29 },
  },
  keep: {
    orb: { x: 552, y: 149, radius: 5 },
    firebox: { x: 448, y: 28, width: 31, height: 29 },
    notes: { x: 281, y: 10, width: 80, height: 28 },
  },
  meadow: {
    orb: { x: 567, y: 138, radius: 6 },
    firebox: { x: 448, y: 32, width: 32, height: 22 },
    notes: { x: 281, y: 9, width: 76, height: 30 },
  },
}
