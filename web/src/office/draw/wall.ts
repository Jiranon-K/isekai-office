import { fill, fillDisc, type Painter } from './draw'
import type { WallPropKind } from '../scene/layout'

const paintWindow: Painter = (context, palette, box) => {
  fill(context, palette, 'wood-dark', box.x, box.y, box.width, box.height)
  fill(context, palette, 'glass', box.x + 2, box.y + 2, box.width - 4, box.height - 4)
  fill(context, palette, 'wood-dark', box.x + box.width / 2 - 1, box.y + 2, 2, box.height - 4)
  fill(context, palette, 'wood-dark', box.x + 2, box.y + box.height / 2 - 1, box.width - 4, 2)
  fill(context, palette, 'paper', box.x + 4, box.y + 4, 3, 1)
}

const paintBanner: Painter = (context, palette, box) => {
  fill(context, palette, 'wood-dark', box.x, box.y + 2, box.width, 3)
  fill(context, palette, 'metal', box.x, box.y + 2, 2, 3)
  fill(context, palette, 'metal', box.x + box.width - 2, box.y + 2, 2, 3)
  const clothHeight = box.height - 14
  fill(context, palette, 'accent', box.x + 4, box.y + 5, box.width - 8, clothHeight)
  fill(context, palette, 'accent-dark', box.x + 4, box.y + 5, 1, clothHeight)
  fill(context, palette, 'accent-dark', box.x + box.width - 5, box.y + 5, 1, clothHeight)
  fill(context, palette, 'accent', box.x + 4, box.y + 5 + clothHeight, 10, 3)
  fill(context, palette, 'accent', box.x + box.width - 14, box.y + 5 + clothHeight, 10, 3)
  fillDisc(context, palette, 'accent-dark', box.x + box.width / 2, box.y + 16, 5)
  fill(context, palette, 'paper', box.x + box.width / 2 - 1, box.y + 13, 2, 6)
}

const NOTES: readonly (readonly [number, number, number, number])[] = [
  [6, 12, 12, 14],
  [22, 14, 12, 12],
  [38, 11, 14, 15],
  [56, 13, 12, 13],
  [72, 12, 12, 15],
  [14, 30, 12, 10],
  [46, 30, 14, 10],
]

const paintQuestBoard: Painter = (context, palette, box) => {
  fill(context, palette, 'wood-dark', box.x, box.y, box.width, box.height)
  fill(context, palette, 'wood-light', box.x + 3, box.y + 3, box.width - 6, box.height - 6)
  fill(context, palette, 'accent', box.x + 32, box.y + 4, 32, 6)
  fill(context, palette, 'accent-dark', box.x + 36, box.y + 6, 24, 2)
  NOTES.forEach(([dx, dy, width, height], index) => {
    fill(context, palette, 'paper', box.x + dx + 6, box.y + dy + 6, width, height)
    fill(context, palette, 'ink', box.x + dx + 8, box.y + dy + 10, width - 4, 1)
    fill(context, palette, 'ink', box.x + dx + 8, box.y + dy + 13, width - 6, 1)
    fill(context, palette, index % 2 === 0 ? 'alert-blocked' : 'alert-waiting', box.x + dx + 6 + width / 2, box.y + dy + 6, 2, 2)
  })
}

const paintFireplace: Painter = (context, palette, box) => {
  fill(context, palette, 'stone-dark', box.x, box.y, box.width, box.height)
  fill(context, palette, 'stone-mid', box.x + 2, box.y + 2, box.width - 4, box.height - 2)
  for (let line = 0; line < 8; line += 1) {
    fill(context, palette, 'stone-dark', box.x + 2, box.y + line * 8, box.width - 4, 1)
  }
  fill(context, palette, 'wood-dark', box.x - 2, box.y + 30, box.width + 4, 6)
  fill(context, palette, 'wood-light', box.x - 2, box.y + 30, box.width + 4, 2)
  fill(context, palette, 'ink', box.x + 12, box.y + 38, 40, 24)
  fill(context, palette, 'stone-light', box.x + 10, box.y + 36, 44, 2)
  fill(context, palette, 'wood-dark', box.x + 16, box.y + 56, 32, 4)
  fill(context, palette, 'wood-mid', box.x + 18, box.y + 57, 28, 2)
  fill(context, palette, 'stone-light', box.x + 4, box.y + box.height - 3, box.width - 8, 3)
}

const paintLantern: Painter = (context, palette, box) => {
  fill(context, palette, 'iron', box.x + 7, box.y - 8, 1, 8)
  fill(context, palette, 'iron', box.x + 4, box.y, 8, 2)
  fill(context, palette, 'ember', box.x + 5, box.y + 2, 6, 6)
  fill(context, palette, 'fire-core', box.x + 7, box.y + 4, 2, 2)
  fill(context, palette, 'iron', box.x + 4, box.y + 8, 8, 1)
}

const paintDoor: Painter = (context, palette, box) => {
  fill(context, palette, 'wood-dark', box.x, box.y, box.width, box.height)
  fill(context, palette, 'rug-a', box.x + 3, box.y + 3, box.width - 6, box.height - 4)
  fill(context, palette, 'rug-b', box.x + 4, box.y + 4, box.width - 8, 1)
}

export const WALL_PAINTERS: Record<WallPropKind, Painter> = {
  window: paintWindow,
  banner: paintBanner,
  questBoard: paintQuestBoard,
  fireplace: paintFireplace,
  lantern: paintLantern,
  door: paintDoor,
}
