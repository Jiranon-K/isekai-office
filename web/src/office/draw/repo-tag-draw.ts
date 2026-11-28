import type { ViewMetrics } from '../scene/view'
import type { Actor } from '../scene/actors'
import { fill } from './draw'
import { drawPlate } from './labels'
import type { OfficePalette } from './palette'
import { NO_REPO_LABEL, namedRepo, repoTagBox, repoTagColour, repoTagGap, repoTagLetter, type TagBox } from './repo-tag'

const LETTER_RATIO = 0.8

function drawLetter(context: CanvasRenderingContext2D, palette: OfficePalette, box: TagBox, repo: string | null): void {
  context.font = `700 ${Math.round(box.size * LETTER_RATIO)}px ${palette.font}`
  context.fillStyle = palette.color('ink')
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(repoTagLetter(repo), Math.round(box.left + box.size / 2), Math.round(box.top + box.size / 2))
}

function drawFullName(context: CanvasRenderingContext2D, palette: OfficePalette, view: ViewMetrics, actor: Actor, box: TagBox): void {
  drawPlate(context, palette, view, {
    text: namedRepo(actor.repo) ?? NO_REPO_LABEL,
    roomX: actor.x,
    roomY: (box.top + box.size + repoTagGap(view) - view.offsetY) / view.scale,
    ratio: 1,
    textColor: 'accent',
    background: 'plate',
    weight: 500,
  })
}

export function drawRepoTag(context: CanvasRenderingContext2D, palette: OfficePalette, view: ViewMetrics, actor: Actor, hovered: boolean): void {
  if (actor.kind !== 'agent') {
    return
  }
  const box = repoTagBox(view, actor)
  const border = Math.max(1, Math.round(view.scale * 0.5))
  fill(context, palette, 'outline', box.left - border, box.top - border, box.size + border * 2, box.size + border * 2)
  fill(context, palette, repoTagColour(actor.repo), box.left, box.top, box.size, box.size)
  drawLetter(context, palette, box, actor.repo)
  if (hovered) {
    drawFullName(context, palette, view, actor, box)
  }
}
