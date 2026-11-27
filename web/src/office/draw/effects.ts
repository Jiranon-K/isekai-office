import { actorMode, type Actor } from '../scene/actors'
import { fill, fillDisc } from './draw'
import type { OfficePalette } from './palette'
import { isStation, type StationId } from '../scene/stations'
import { hashString } from '../scene/hash'

export type Workers = Record<StationId, Actor[]>

const FIREPLACE_BASE = { x: 446, y: 60, columns: 5 }
const FORGE_BASE = { x: 508, y: 76, columns: 4 }

export function collectWorkers(actors: Iterable<Actor>): Workers {
  const workers: Workers = { desk: [], archive: [], crystal: [], forge: [] }
  for (const actor of actors) {
    if (actor.kind === 'agent' && actorMode(actor) === 'work' && isStation(actor.groupId)) {
      workers[actor.groupId].push(actor)
    }
  }
  return workers
}

function drawFlames(
  context: CanvasRenderingContext2D,
  palette: OfficePalette,
  base: { x: number; y: number; columns: number },
  maxHeight: number,
  seconds: number,
): void {
  const tick = Math.floor(seconds * 7)
  for (let column = 0; column < base.columns; column += 1) {
    const height = Math.max(4, Math.round(maxHeight * (0.45 + 0.11 * ((tick + column * 3) % 5))))
    const x = base.x + column * 7
    fill(context, palette, 'fire-b', x, base.y - height, 6, height)
    fill(context, palette, 'fire-a', x + 1, base.y - height + 3, 4, height - 3)
    fill(context, palette, 'fire-core', x + 2, base.y - Math.floor(height / 2), 2, Math.floor(height / 2) - 1)
  }
}

export function drawAmbientFlames(
  context: CanvasRenderingContext2D,
  palette: OfficePalette,
  seconds: number,
  forgeWorkers: number,
  sourceReady: boolean,
): void {
  drawFlames(context, palette, FIREPLACE_BASE, sourceReady ? 20 : 5, seconds)
  drawFlames(context, palette, FORGE_BASE, 10 + Math.min(forgeWorkers, 3) * 4, seconds)
}

function drawSparks(context: CanvasRenderingContext2D, palette: OfficePalette, actor: Actor, seconds: number): void {
  const seed = hashString(actor.id)
  for (let spark = 0; spark < 5; spark += 1) {
    const progress = (seconds * 1.6 + spark * 0.2 + (seed % 10) / 10) % 1
    const side = (((seed >>> (spark * 2)) % 9) - 4) * 1.4
    const x = actor.x + side * (0.4 + progress)
    const y = actor.y - 16 - progress * 14 + progress * progress * 16
    context.globalAlpha = 1 - progress
    fill(context, palette, spark % 2 === 0 ? 'ember' : 'fire-a', Math.round(x), Math.round(y), 1, 1)
  }
  context.globalAlpha = 1
}

function drawPageFlick(context: CanvasRenderingContext2D, palette: OfficePalette, actor: Actor, seconds: number): void {
  const flip = Math.abs(Math.cos(seconds * 5 + actor.phase))
  const width = Math.max(1, Math.round(flip * 6))
  fill(context, palette, 'paper', Math.round(actor.x + 5 - width / 2), Math.round(actor.y - 22), width, 5)
  const rise = (seconds * 0.9 + actor.phase) % 1
  context.globalAlpha = 1 - rise
  fill(context, palette, 'paper', Math.round(actor.x - 8), Math.round(actor.y - 24 - rise * 8), 3, 2)
  context.globalAlpha = 1
}

function drawQuill(context: CanvasRenderingContext2D, palette: OfficePalette, actor: Actor, seconds: number): void {
  const stroke = Math.floor(seconds * 6 + actor.phase) % 3
  const x = Math.round(actor.x + 5 + stroke)
  fill(context, palette, 'paper', x, Math.round(actor.y - 18), 1, 5)
  fill(context, palette, 'crystal-a', x + 1, Math.round(actor.y - 19), 1, 2)
  fill(context, palette, 'ink', x - 1, Math.round(actor.y - 13), 1, 1)
}

function drawCrystalGlow(
  context: CanvasRenderingContext2D,
  palette: OfficePalette,
  workerCount: number,
  seconds: number,
  orb: { x: number; y: number },
): void {
  const pulse = (Math.sin(seconds * 3) + 1) / 2
  const strength = Math.min(workerCount, 3)
  for (let ring = 0; ring < 3; ring += 1) {
    context.globalAlpha = 0.1 + 0.08 * pulse * strength - ring * 0.025
    fillDisc(context, palette, 'crystal-a', orb.x, orb.y, 12 + ring * 5 + Math.round(pulse * 3))
  }
  context.globalAlpha = 1
  const orbit = seconds * 2
  for (let star = 0; star < 3; star += 1) {
    const angle = orbit + (star * Math.PI * 2) / 3
    fill(
      context,
      palette,
      'crystal-b',
      Math.round(orb.x + Math.cos(angle) * 16),
      Math.round(orb.y + Math.sin(angle) * 9),
      2,
      2,
    )
  }
}

export function drawStationEffects(
  context: CanvasRenderingContext2D,
  palette: OfficePalette,
  workers: Workers,
  seconds: number,
  orb: { x: number; y: number },
): void {
  workers.forge.forEach((actor) => drawSparks(context, palette, actor, seconds))
  workers.archive.forEach((actor) => drawPageFlick(context, palette, actor, seconds))
  workers.desk.forEach((actor) => drawQuill(context, palette, actor, seconds))
  if (workers.crystal.length > 0) {
    drawCrystalGlow(context, palette, workers.crystal.length, seconds, orb)
  }
}

function drawQuietMark(context: CanvasRenderingContext2D, palette: OfficePalette, actor: Actor): void {
  const x = Math.round(actor.x - 5)
  const y = Math.round(actor.y - 38)
  fill(context, palette, 'bubble-edge', x, y, 11, 11)
  fill(context, palette, 'bubble', x + 1, y + 1, 9, 8)
  fill(context, palette, 'bubble-edge', x + 4, y + 11, 3, 2)
  for (const dx of [2, 5, 8]) {
    fill(context, palette, 'quiet', x + dx, y + 4, 2, 2)
  }
}

export function drawBubble(context: CanvasRenderingContext2D, palette: OfficePalette, actor: Actor, seconds: number): void {
  if (actor.kind === 'agent' && actor.quiet && actor.state === 'working' && actor.path.length === 0) {
    drawQuietMark(context, palette, actor)
    return
  }
  if (actor.kind !== 'agent' || (actor.state !== 'waiting' && actor.state !== 'blocked') || actor.path.length > 0) {
    return
  }
  const blocked = actor.state === 'blocked'
  const bounce = Math.round(Math.abs(Math.sin(seconds * 6 + actor.phase)) * 3)
  const x = Math.round(actor.x - 5)
  const y = Math.round(actor.y - 38 - bounce)
  fill(context, palette, 'bubble-edge', x, y, 11, 11)
  fill(context, palette, 'bubble', x + 1, y + 1, 9, 8)
  fill(context, palette, 'bubble-edge', x + 4, y + 11, 3, 2)
  const alert = blocked ? 'alert-blocked' : 'alert-waiting'
  fill(context, palette, alert, x + 5, y + 2, 1, 4)
  fill(context, palette, alert, x + 5, y + 7, 1, 1)
  if (blocked) {
    const drop = Math.floor(seconds * 2 + actor.phase) % 2
    fill(context, palette, 'sweat', Math.round(actor.x + 7), Math.round(actor.y - 22 + drop), 2, 3)
    fill(context, palette, 'sweat', Math.round(actor.x + 7), Math.round(actor.y - 23 + drop), 1, 1)
  }
}
