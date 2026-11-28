import type { AgentState, OfficeAgent } from '@shared/types'
import { hashString } from './hash'
import { manaRatio } from './mana'
import { DOOR_ENTRY, NPC_SPOTS, TILE_SIZE, type Facing, type Spot } from './layout'
import { findPath, type TilePoint, type WalkGrid } from './pathfinding'
import { groupForAgent, SPOT_GROUPS, type GroupId } from './stations'
import { lookFromId, type Look } from '../draw/sprites'
import type { Party, PartyColour } from '@/party/party-logic'

export type ActorMode = 'walk' | 'idle' | 'work'

export type Actor = {
  id: string
  kind: 'agent' | 'npc'
  label: string
  look: Look
  x: number
  y: number
  tile: TilePoint
  facing: Facing
  path: TilePoint[]
  spot: Spot | null
  groupId: GroupId | null
  spotIndex: number
  state: AgentState | null
  stateSince: number | null
  mana: number | null
  quiet: boolean
  inConflict: boolean
  partyKey: string | null
  partyColour: PartyColour | null
  npcMode: 'idle' | 'work'
  leaving: boolean
  walked: number
  phase: number
}

const WALK_SPEED = 56
const FOOT_OFFSET_X = TILE_SIZE / 2
const FOOT_OFFSET_Y = 14

export function tileToWorld(tile: TilePoint): { x: number; y: number } {
  return { x: tile.x * TILE_SIZE + FOOT_OFFSET_X, y: tile.y * TILE_SIZE + FOOT_OFFSET_Y }
}

function createActor(id: string, kind: Actor['kind'], label: string, look: Look, tile: TilePoint): Actor {
  const world = tileToWorld(tile)
  return {
    id,
    kind,
    label,
    look,
    x: world.x,
    y: world.y,
    tile,
    facing: 'down',
    path: [],
    spot: null,
    groupId: null,
    spotIndex: -1,
    state: null,
    stateSince: null,
    mana: null,
    quiet: false,
    inConflict: false,
    partyKey: null,
    partyColour: null,
    npcMode: 'idle',
    leaving: false,
    walked: 0,
    phase: (hashString(id) % 628) / 100,
  }
}

export function createNpcActors(): Map<string, Actor> {
  const actors = new Map<string, Actor>()
  const bartender = createActor(
    'npc:bartender',
    'npc',
    'NPC บาร์เทนเดอร์',
    { characterClass: 'bartender', skin: 2, hair: 1 },
    NPC_SPOTS.bartender,
  )
  bartender.npcMode = 'work'
  bartender.spot = NPC_SPOTS.bartender
  bartender.facing = NPC_SPOTS.bartender.facing
  const receptionist = createActor(
    'npc:receptionist',
    'npc',
    'NPC พนักงานต้อนรับ',
    { characterClass: 'receptionist', skin: 1, hair: 3 },
    NPC_SPOTS.receptionist,
  )
  receptionist.spot = NPC_SPOTS.receptionist
  receptionist.facing = NPC_SPOTS.receptionist.facing
  actors.set(bartender.id, bartender)
  actors.set(receptionist.id, receptionist)
  return actors
}

export function actorMode(actor: Actor): ActorMode {
  if (actor.path.length > 0) {
    return 'walk'
  }
  if (actor.kind === 'npc') {
    return actor.npcMode
  }
  return actor.state === 'working' ? 'work' : 'idle'
}

function placeAtTile(actor: Actor, tile: TilePoint): void {
  const world = tileToWorld(tile)
  actor.x = world.x
  actor.y = world.y
  actor.tile = tile
  actor.path = []
}

function routeTo(actor: Actor, goal: TilePoint, grid: WalkGrid, snap: boolean): void {
  const path = snap ? null : findPath(grid, actor.tile, goal)
  if (!path) {
    placeAtTile(actor, goal)
    return
  }
  actor.path = path
}

function pickSpotIndex(id: string, groupId: GroupId, occupied: ReadonlySet<number>): number {
  const count = SPOT_GROUPS[groupId].length
  const preferred = hashString(id) % count
  for (let offset = 0; offset < count; offset += 1) {
    const candidate = (preferred + offset) % count
    if (!occupied.has(candidate)) {
      return candidate
    }
  }
  return preferred
}

function assignSpot(
  actor: Actor,
  groupId: GroupId,
  occupancy: Map<GroupId, Set<number>>,
  grid: WalkGrid,
  snap: boolean,
): void {
  const occupied = occupancy.get(groupId) ?? new Set<number>()
  occupancy.set(groupId, occupied)
  const index = pickSpotIndex(actor.id, groupId, occupied)
  const spot = SPOT_GROUPS[groupId][index]
  if (!spot) {
    return
  }
  occupied.add(index)
  actor.groupId = groupId
  actor.spotIndex = index
  actor.spot = spot
  actor.leaving = false
  routeTo(actor, spot, grid, snap)
  if (actor.path.length === 0) {
    actor.facing = spot.facing
  }
}

function retireMissing(actors: Map<string, Actor>, present: ReadonlySet<string>, grid: WalkGrid, snap: boolean): void {
  for (const actor of [...actors.values()]) {
    if (actor.kind === 'npc' || present.has(actor.id) || actor.leaving) {
      continue
    }
    if (snap) {
      actors.delete(actor.id)
      continue
    }
    actor.leaving = true
    actor.spot = null
    actor.groupId = null
    actor.spotIndex = -1
    actor.state = null
    actor.path = findPath(grid, actor.tile, DOOR_ENTRY) ?? []
  }
}

export function syncActors(
  actors: Map<string, Actor>,
  agents: readonly OfficeAgent[],
  grid: WalkGrid,
  snap: boolean,
  contextWindow: number,
  groupOf: (agent: OfficeAgent) => GroupId = groupForAgent,
): void {
  retireMissing(actors, new Set(agents.map((agent) => agent.id)), grid, snap)
  const occupancy = new Map<GroupId, Set<number>>()
  const pending: { actor: Actor; groupId: GroupId }[] = []
  for (const agent of [...agents].sort((first, second) => first.id.localeCompare(second.id))) {
    const existing = actors.get(agent.id)
    const actor = existing ?? createActor(agent.id, 'agent', agent.title, lookFromId(agent.id), DOOR_ENTRY)
    actors.set(agent.id, actor)
    actor.label = agent.title
    actor.state = agent.state
    actor.stateSince = agent.stateSince
    actor.mana = manaRatio(agent.contextTokens, contextWindow)
    const groupId = groupOf(agent)
    if (actor.groupId === groupId && !actor.leaving) {
      const occupied = occupancy.get(groupId) ?? new Set<number>()
      occupancy.set(groupId, occupied)
      occupied.add(actor.spotIndex)
      continue
    }
    pending.push({ actor, groupId })
  }
  for (const { actor, groupId } of pending) {
    assignSpot(actor, groupId, occupancy, grid, snap)
  }
}

export function markQuiet(actors: Map<string, Actor>, quiet: ReadonlyMap<string, number>): void {
  for (const actor of actors.values()) {
    actor.quiet = actor.kind === 'agent' && quiet.has(actor.id)
  }
}

export function markParties(actors: Map<string, Actor>, partyByAgent: ReadonlyMap<string, Party>): void {
  for (const actor of actors.values()) {
    const party = actor.kind === 'agent' ? partyByAgent.get(actor.id) : undefined
    actor.partyKey = party?.key ?? null
    actor.partyColour = party?.colour ?? null
  }
}

export function markConflicts(actors: Map<string, Actor>, conflictIds?: ReadonlySet<string>): void {
  for (const actor of actors.values()) {
    actor.inConflict = actor.kind === 'agent' && (conflictIds?.has(actor.id) ?? false)
  }
}

function facingFromVector(dx: number, dy: number): Facing {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left'
  }
  return dy > 0 ? 'down' : 'up'
}

function advanceActor(actor: Actor, deltaSeconds: number): void {
  let remaining = WALK_SPEED * deltaSeconds
  while (remaining > 0) {
    const next = actor.path[0]
    if (!next) {
      break
    }
    const target = tileToWorld(next)
    const dx = target.x - actor.x
    const dy = target.y - actor.y
    const distance = Math.hypot(dx, dy)
    actor.facing = facingFromVector(dx, dy)
    if (distance <= remaining) {
      actor.x = target.x
      actor.y = target.y
      actor.tile = next
      actor.path.shift()
      actor.walked += distance
      remaining -= distance
      continue
    }
    actor.x += (dx / distance) * remaining
    actor.y += (dy / distance) * remaining
    actor.walked += remaining
    remaining = 0
  }
  if (actor.path.length === 0 && actor.spot) {
    actor.facing = actor.spot.facing
  }
}

function snapActor(actor: Actor): void {
  const last = actor.path[actor.path.length - 1]
  if (last) {
    placeAtTile(actor, last)
  }
  if (actor.spot) {
    actor.facing = actor.spot.facing
  }
}

export function updateActors(actors: Map<string, Actor>, deltaSeconds: number, snap: boolean): void {
  for (const actor of [...actors.values()]) {
    if (snap) {
      snapActor(actor)
    } else {
      advanceActor(actor, deltaSeconds)
    }
    if (actor.leaving && actor.path.length === 0) {
      actors.delete(actor.id)
    }
  }
}
