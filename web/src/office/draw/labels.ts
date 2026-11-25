import type { Actor } from '../scene/actors'
import { fill } from './draw'
import { manaColor } from '../scene/mana'
import type { OfficePalette } from './palette'
import { STATION_IDS, STATION_LABELS, STATION_LABEL_POSITIONS } from '../scene/stations'
import { toScreenPoint, type ViewMetrics } from '../scene/view'

const TITLE_LIMIT = 18
const ELLIPSIS = '…'

export function truncateTitle(title: string): string {
  const letters = Array.from(title)
  if (letters.length <= TITLE_LIMIT) {
    return title
  }
  return letters.slice(0, TITLE_LIMIT - 1).join('') + ELLIPSIS
}

function plateFontSize(view: ViewMetrics, ratio: number): number {
  const preferred = view.scale * 2.4 * ratio
  return Math.round(Math.min(Math.max(preferred, 9 * view.dpr * ratio), 14 * view.dpr * ratio))
}

function plateHeight(view: ViewMetrics): number {
  return Math.round(plateFontSize(view, 1) * 1.5)
}

type Plate = {
  text: string
  roomX: number
  roomY: number
  ratio: number
  textColor: 'accent' | 'plate-muted' | 'accent-dark'
  background: 'plate' | 'accent'
  weight: number
}

function drawPlate(context: CanvasRenderingContext2D, palette: OfficePalette, view: ViewMetrics, plate: Plate): void {
  const fontSize = plateFontSize(view, plate.ratio)
  context.font = `${plate.weight} ${fontSize}px ${palette.font}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  const paddingX = Math.round(fontSize * 0.5)
  const height = Math.round(fontSize * 1.5)
  const width = Math.round(context.measureText(plate.text).width + paddingX * 2)
  const point = toScreenPoint(view, plate.roomX, plate.roomY)
  const left = Math.round(point.x - width / 2)
  fill(context, palette, plate.background, left, Math.round(point.y), width, height)
  context.fillStyle = palette.color(plate.textColor)
  context.fillText(plate.text, Math.round(point.x), Math.round(point.y + height / 2))
}

export function drawActorPlate(
  context: CanvasRenderingContext2D,
  palette: OfficePalette,
  view: ViewMetrics,
  actor: Actor,
  selected: boolean,
): void {
  const isAgent = actor.kind === 'agent'
  drawPlate(context, palette, view, {
    text: isAgent ? truncateTitle(actor.label) : actor.label,
    roomX: actor.x,
    roomY: actor.y + 2,
    ratio: 1,
    textColor: !isAgent ? 'plate-muted' : selected ? 'accent-dark' : 'accent',
    background: selected ? 'accent' : 'plate',
    weight: isAgent ? 700 : 500,
  })
}

const MANA_WIDTH_UNITS = 16
const MANA_HEIGHT_UNITS = 1.6
const MANA_GAP_UNITS = 0.6

export function drawManaBar(context: CanvasRenderingContext2D, palette: OfficePalette, view: ViewMetrics, actor: Actor): void {
  if (actor.kind !== 'agent' || actor.mana === null) {
    return
  }
  const border = Math.max(1, Math.round(view.scale * 0.5))
  const width = Math.round(view.scale * MANA_WIDTH_UNITS)
  const height = Math.max(border * 3, Math.round(view.scale * MANA_HEIGHT_UNITS))
  const point = toScreenPoint(view, actor.x, actor.y + 2)
  const left = Math.round(point.x - width / 2)
  const top = Math.round(point.y + plateHeight(view) + view.scale * MANA_GAP_UNITS)
  const innerWidth = width - border * 2
  fill(context, palette, 'outline', left, top, width, height)
  fill(context, palette, 'mana-empty', left + border, top + border, innerWidth, height - border * 2)
  const filled = Math.round(innerWidth * actor.mana)
  if (filled > 0) {
    fill(context, palette, manaColor(actor.mana), left + border, top + border, filled, height - border * 2)
  }
}

export function drawHotspotLabel(
  context: CanvasRenderingContext2D,
  palette: OfficePalette,
  view: ViewMetrics,
  text: string,
  roomX: number,
  roomY: number,
): void {
  drawPlate(context, palette, view, { text, roomX, roomY, ratio: 1, textColor: 'accent-dark', background: 'accent', weight: 700 })
}

export function drawStationLabels(context: CanvasRenderingContext2D, palette: OfficePalette, view: ViewMetrics): void {
  for (const station of STATION_IDS) {
    const position = STATION_LABEL_POSITIONS[station]
    drawPlate(context, palette, view, {
      text: STATION_LABELS[station],
      roomX: position.x,
      roomY: position.y,
      ratio: 0.85,
      textColor: 'plate-muted',
      background: 'plate',
      weight: 500,
    })
  }
}

export function drawSign(
  context: CanvasRenderingContext2D,
  palette: OfficePalette,
  view: ViewMetrics,
  text: string,
  roomX: number,
  roomY: number,
  size: number,
): void {
  const fontSize = Math.round(view.scale * size)
  context.font = `700 ${fontSize}px ${palette.font}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  const border = Math.max(1, Math.round(view.scale))
  const paddingX = Math.round(fontSize * 1.1)
  const width = Math.round(context.measureText(text).width + paddingX * 2)
  const height = Math.round(fontSize * 2.2)
  const point = toScreenPoint(view, roomX, roomY)
  const left = Math.round(point.x - width / 2)
  const top = Math.round(point.y - height / 2)
  const postWidth = Math.round(fontSize * 0.7)
  fill(context, palette, 'shadow', left + border * 2, top + border * 2, width, height + postWidth * 2)
  fill(context, palette, 'wood-dark', Math.round(point.x - postWidth / 2), top + height, postWidth, postWidth * 2)
  fill(context, palette, 'wood-dark', left, top, width, height)
  fill(context, palette, 'wood-mid', left + border, top + border, width - border * 2, height - border * 2)
  fill(context, palette, 'wood-light', left + border, top + border, width - border * 2, border)
  fill(context, palette, 'iron', left + border * 2, top + border * 2, border * 2, border * 2)
  fill(context, palette, 'iron', left + width - border * 4, top + border * 2, border * 2, border * 2)
  context.fillStyle = palette.color('ink')
  context.fillText(text, Math.round(point.x + border), Math.round(point.y + border))
  context.fillStyle = palette.color('paper')
  context.fillText(text, Math.round(point.x), Math.round(point.y))
}
