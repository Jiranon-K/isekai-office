import { actorMode, type Actor } from './office-actors'
import type { World } from '@/lib/theme'
import { WORLD_ANCHORS } from './office-anchors'
import { fill } from './office-draw'
import { collectWorkers, drawAmbientFlames, drawBubble, drawStationEffects } from './office-effects'
import { drawHotspotLabels, drawHotspotMarkers, drawHotspotOutlines } from './office-hotspot-draw'
import type { HotspotView } from './office-hotspots'
import { drawActorPlate, drawManaBar, drawSign, drawStationLabels } from './office-labels'
import { ROOM_HEIGHT, ROOM_WIDTH } from './office-layout'
import type { OfficePalette } from './office-palette'
import { drawSignals, type Signals } from './office-signals'
import {
  FACING_ROWS,
  FRAMES,
  SPRITE_ANCHOR_X,
  SPRITE_ANCHOR_Y,
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
  WALK_CYCLE,
  getSpriteSheet,
} from './office-sprites'
import type { ViewMetrics } from './office-view'

export type RoomLayers = { room: HTMLCanvasElement; shade: HTMLCanvasElement | null; painted: boolean }

export type FrameInput = {
  context: CanvasRenderingContext2D
  view: ViewMetrics
  palette: OfficePalette
  layers: RoomLayers
  actors: Iterable<Actor>
  selectedId: string | null
  seconds: number
  animate: boolean
  orcaRunning: boolean
  agentCount: number
  fontsReady: boolean
  world: World
  signals: Signals
  hotspots: HotspotView
}

const SEATED_DROP = 3
const SEATED_CUT = 5
const SIGN_CENTER = { x: ROOM_WIDTH / 2, y: ROOM_HEIGHT / 2 }

function frameFor(actor: Actor, seconds: number, animate: boolean): number {
  const mode = actorMode(actor)
  if (mode === 'walk') {
    return WALK_CYCLE[Math.floor(actor.walked / 5) % WALK_CYCLE.length] ?? FRAMES.idle
  }
  if (mode !== 'work') {
    return FRAMES.idle
  }
  const slow = actor.kind === 'npc' ? 1.5 : 4
  return animate && Math.floor(seconds * slow + actor.phase) % 2 === 1 ? FRAMES.workB : FRAMES.workA
}

function bobFor(actor: Actor, seconds: number, animate: boolean): number {
  if (!animate || actorMode(actor) === 'walk') {
    return 0
  }
  return Math.sin(seconds * 2.2 + actor.phase) > 0.5 ? -1 : 0
}

function drawGround(context: CanvasRenderingContext2D, palette: OfficePalette, actor: Actor, selected: boolean, seconds: number, animate: boolean): void {
  const seated = actor.spot?.seated === true && actor.path.length === 0
  if (!seated) {
    fill(context, palette, 'shadow', Math.round(actor.x) - 6, Math.round(actor.y) - 3, 12, 2)
    fill(context, palette, 'shadow', Math.round(actor.x) - 4, Math.round(actor.y) - 4, 8, 1)
  }
  if (!selected) {
    return
  }
  context.globalAlpha = animate ? 0.7 + 0.3 * Math.sin(seconds * 4) : 1
  context.strokeStyle = palette.color('accent')
  context.lineWidth = 1.5
  context.beginPath()
  context.ellipse(actor.x, actor.y - 2, 9, 4, 0, 0, Math.PI * 2)
  context.stroke()
  context.globalAlpha = 1
}

function drawSprite(context: CanvasRenderingContext2D, palette: OfficePalette, actor: Actor, seconds: number, animate: boolean): void {
  const sheet = getSpriteSheet(palette, actor.look)
  const seated = actor.spot?.seated === true && actor.path.length === 0
  const frame = frameFor(actor, seconds, animate)
  const sourceX = frame * SPRITE_WIDTH
  const sourceY = FACING_ROWS[actor.facing] * SPRITE_HEIGHT
  const sourceHeight = seated ? SPRITE_HEIGHT - SEATED_CUT : SPRITE_HEIGHT
  const drop = seated ? SEATED_DROP : 0
  const destinationX = Math.round(actor.x - SPRITE_ANCHOR_X)
  const destinationY = Math.round(actor.y - SPRITE_ANCHOR_Y + drop + bobFor(actor, seconds, animate))
  context.drawImage(sheet, sourceX, sourceY, SPRITE_WIDTH, sourceHeight, destinationX, destinationY, SPRITE_WIDTH, sourceHeight)
}

function drawEmptySigns(context: CanvasRenderingContext2D, palette: OfficePalette, view: ViewMetrics, input: FrameInput): void {
  if (!input.orcaRunning) {
    drawSign(context, palette, view, 'Orca ปิดอยู่', SIGN_CENTER.x, SIGN_CENTER.y, 9)
    return
  }
  if (input.agentCount === 0) {
    drawSign(context, palette, view, 'ยังไม่มี session', SIGN_CENTER.x, SIGN_CENTER.y, 6)
  }
}

export function renderFrame(input: FrameInput): void {
  const { context, view, palette, layers, seconds, animate } = input
  const sorted = [...input.actors].sort((first, second) => first.y - second.y)
  const workers = collectWorkers(sorted)
  const anchors = WORLD_ANCHORS[input.world]
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, view.width, view.height)
  fill(context, palette, 'ink', 0, 0, view.width, view.height)
  context.imageSmoothingEnabled = false
  context.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY)
  context.drawImage(layers.room, 0, 0)
  if (!layers.painted) {
    drawAmbientFlames(context, palette, animate ? seconds : 0, workers.forge.length, input.orcaRunning)
  }
  for (const actor of sorted) {
    drawGround(context, palette, actor, actor.id === input.selectedId, seconds, animate)
  }
  for (const actor of sorted) {
    drawSprite(context, palette, actor, seconds, animate)
  }
  if (layers.shade) {
    context.drawImage(layers.shade, 0, 0)
  }
  if (animate) {
    drawStationEffects(context, palette, workers, seconds, anchors.orb)
  }
  if (layers.painted) {
    drawSignals(context, palette, anchors, input.signals, animate ? seconds : 0)
  }
  for (const actor of sorted) {
    drawBubble(context, palette, actor, animate ? seconds : 0)
  }
  drawHotspotOutlines(context, palette, input.hotspots)
  drawHotspotMarkers(context, palette, animate ? seconds : 0)
  context.setTransform(1, 0, 0, 1, 0, 0)
  if (!input.fontsReady) {
    return
  }
  drawStationLabels(context, palette, view)
  for (const actor of sorted) {
    drawActorPlate(context, palette, view, actor, actor.id === input.selectedId)
    drawManaBar(context, palette, view, actor)
  }
  drawHotspotLabels(context, palette, view, input.hotspots)
  drawEmptySigns(context, palette, view, input)
}
