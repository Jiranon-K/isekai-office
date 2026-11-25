import { describe, expect, test } from 'bun:test'
import { NPC_SPOTS, PROPS, ROOM_HEIGHT, ROOM_WIDTH, TILE_SIZE, type PropKind } from './office-layout'
import {
  AGENT_HALF_WIDTH,
  AGENT_HEIGHT,
  HOTSPOTS,
  PULSE_MS,
  REST_ALPHA,
  agentHitRect,
  hotspotAt,
  hotspotBounds,
  hotspotById,
  labelAlpha,
  outlineAlpha,
  pulseAlpha,
  resolvePick,
  type HotspotId,
  type HotspotView,
} from './office-hotspots'

const PROP_FOR_HOTSPOT: Record<HotspotId, PropKind> = {
  questBoard: 'questBoard',
  reception: 'receptionCounter',
  windows: 'window',
  door: 'door',
  orb: 'crystalTable',
  barShelf: 'barShelf',
  hearth: 'fireplace',
  archive: 'bookshelves',
}

function propCentres(kind: PropKind): { x: number; y: number }[] {
  return PROPS.filter((prop) => prop.kind === kind).map((prop) => ({
    x: (prop.x + prop.width / 2) * TILE_SIZE,
    y: (prop.y + prop.height / 2) * TILE_SIZE,
  }))
}

function tileCentre(tile: { x: number; y: number }): { x: number; y: number } {
  return { x: (tile.x + 0.5) * TILE_SIZE, y: (tile.y + 0.5) * TILE_SIZE }
}

const IDLE: HotspotView = { hoveredId: null, openId: null, revealAll: false, pulse: 0 }

describe('hotspot table', () => {
  test('every hotspot sits inside the room', () => {
    const outside = HOTSPOTS.filter((hotspot) => {
      const bounds = hotspotBounds(hotspot)
      return bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > ROOM_WIDTH || bounds.y + bounds.height > ROOM_HEIGHT
    })
    expect(outside.map((hotspot) => hotspot.id)).toEqual([])
  })

  test('every hotspot covers the centre of the prop it stands for', () => {
    const missed = HOTSPOTS.flatMap((hotspot) =>
      propCentres(PROP_FOR_HOTSPOT[hotspot.id])
        .filter((centre) => hotspotAt(centre.x, centre.y)?.id !== hotspot.id)
        .map((centre) => `${hotspot.id}:${centre.x},${centre.y}`),
    )
    expect(missed).toEqual([])
  })

  test('every hotspot has a Thai label and a hint', () => {
    const unlabelled = HOTSPOTS.filter((hotspot) => !/[฀-๿]/.test(hotspot.label) || hotspot.hint.length === 0)
    expect(unlabelled.map((hotspot) => hotspot.id)).toEqual([])
  })

  test('only the windows act without a panel', () => {
    const toggles = HOTSPOTS.filter((hotspot) => hotspot.action.kind === 'toggleMode').map((hotspot) => hotspot.id)
    expect(toggles).toEqual(['windows'])
  })
})

describe('hotspot hit test', () => {
  test('both windows belong to one hotspot', () => {
    expect(hotspotAt(4 * TILE_SIZE, TILE_SIZE)?.id).toBe('windows')
    expect(hotspotAt(9 * TILE_SIZE, TILE_SIZE)?.id).toBe('windows')
  })

  test('the receptionist and the bartender open their own hotspots', () => {
    const receptionist = tileCentre(NPC_SPOTS.receptionist)
    const bartender = tileCentre(NPC_SPOTS.bartender)
    expect(hotspotAt(receptionist.x, receptionist.y)?.id).toBe('reception')
    expect(hotspotAt(bartender.x, bartender.y)?.id).toBe('barShelf')
  })

  test('open floor and plain furniture are not hotspots', () => {
    expect(hotspotAt(20 * TILE_SIZE, 12 * TILE_SIZE)).toBeNull()
    expect(hotspotAt(6 * TILE_SIZE, 10 * TILE_SIZE)).toBeNull()
    expect(hotspotAt(-1, -1)).toBeNull()
  })

  test('the right and bottom edges of a rect are outside it', () => {
    const board = hotspotById('questBoard').rects[0]
    expect(board).toBeDefined()
    if (!board) {
      return
    }
    expect(hotspotAt(board.x, board.y)?.id).toBe('questBoard')
    expect(hotspotAt(board.x + board.width, board.y)).toBeNull()
  })
})

describe('resolvePick', () => {
  test('an agent wins over the hotspot under the same pointer', () => {
    expect(resolvePick('agent-1', 20 * TILE_SIZE, TILE_SIZE)).toEqual({ kind: 'agent', id: 'agent-1' })
  })

  test('a hotspot is picked when no agent is there', () => {
    expect(resolvePick(null, 20 * TILE_SIZE, TILE_SIZE)).toEqual({ kind: 'hotspot', id: 'questBoard' })
  })

  test('nothing is picked on open floor', () => {
    expect(resolvePick(null, 20 * TILE_SIZE, 12 * TILE_SIZE)).toBeNull()
  })
})

describe('outline visibility', () => {
  test('every hotspot keeps a faint outline at rest so it reads as clickable', () => {
    expect(HOTSPOTS.map((hotspot) => outlineAlpha(IDLE, hotspot.id))).toEqual(HOTSPOTS.map(() => REST_ALPHA))
  })

  test('no label shows at rest', () => {
    expect(HOTSPOTS.map((hotspot) => labelAlpha(IDLE, hotspot.id))).toEqual(HOTSPOTS.map(() => 0))
  })

  test('hover shows the outline and the label of that hotspot only', () => {
    const view = { ...IDLE, hoveredId: 'door' as const }
    expect(outlineAlpha(view, 'door')).toBe(1)
    expect(labelAlpha(view, 'door')).toBe(1)
    expect(outlineAlpha(view, 'orb')).toBe(REST_ALPHA)
    expect(labelAlpha(view, 'orb')).toBe(0)
  })

  test('holding the reveal key shows every outline and label', () => {
    const view = { ...IDLE, revealAll: true }
    expect(HOTSPOTS.every((hotspot) => outlineAlpha(view, hotspot.id) === 1 && labelAlpha(view, hotspot.id) === 1)).toBe(true)
  })

  test('the open hotspot keeps its outline without a label', () => {
    const view = { ...IDLE, openId: 'hearth' as const }
    expect(outlineAlpha(view, 'hearth')).toBeGreaterThan(REST_ALPHA)
    expect(labelAlpha(view, 'hearth')).toBe(0)
  })
})

describe('first visit pulse', () => {
  test('is off before it starts and after it ends', () => {
    expect(pulseAlpha(null, 100, true)).toBe(0)
    expect(pulseAlpha(1000, 999, true)).toBe(0)
    expect(pulseAlpha(1000, 1000 + PULSE_MS, true)).toBe(0)
  })

  test('rises to full at the middle and falls again', () => {
    expect(pulseAlpha(0, PULSE_MS / 2, true)).toBeCloseTo(1)
    expect(pulseAlpha(0, PULSE_MS / 10, true)).toBeLessThan(0.5)
    expect(pulseAlpha(0, PULSE_MS * 0.9, true)).toBeLessThan(0.5)
  })

  test('holds steady instead of fading when motion is reduced', () => {
    expect(pulseAlpha(0, 10, false)).toBe(1)
  })
})

describe('agent hit rect', () => {
  test('is centred on the feet and reaches up over the body', () => {
    expect(agentHitRect(100, 200)).toEqual({
      x: 100 - AGENT_HALF_WIDTH,
      y: 200 - AGENT_HEIGHT,
      width: AGENT_HALF_WIDTH * 2,
      height: AGENT_HEIGHT,
    })
  })
})
