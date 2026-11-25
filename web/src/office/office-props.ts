import { fill, fillDisc, type Painter } from './office-draw'
import type { FloorPropKind } from './office-layout'
import type { ColorName } from './office-palette'

const BOOK_COLORS: readonly ColorName[] = ['book-red', 'book-teal', 'book-amber', 'book-violet']
const BOTTLE_COLORS: readonly ColorName[] = ['crystal-a', 'book-red', 'book-amber', 'leaf-light', 'crystal-b']

const paintBookshelves: Painter = (context, palette, box) => {
  fill(context, palette, 'wood-dark', box.x, box.y, box.width, box.height)
  for (let shelf = 0; shelf < 2; shelf += 1) {
    const shelfTop = box.y + shelf * 16
    for (let book = 0; book < (box.width - 4) / 4; book += 1) {
      const color = BOOK_COLORS[(book * 3 + shelf) % BOOK_COLORS.length] ?? 'book-red'
      const height = 8 + ((book * 5 + shelf * 2) % 4)
      fill(context, palette, color, box.x + 2 + book * 4, shelfTop + 13 - height, 3, height)
    }
    fill(context, palette, 'wood-light', box.x, shelfTop + 13, box.width, 3)
  }
  fill(context, palette, 'wood-mid', box.x, box.y, box.width, 1)
}

const paintDesk: Painter = (context, palette, box) => {
  fill(context, palette, 'wood-dark', box.x, box.y, box.width, box.height)
  fill(context, palette, 'wood-light', box.x + 1, box.y + 1, box.width - 2, 18)
  fill(context, palette, 'wood-mid', box.x + 1, box.y + 19, box.width - 2, 11)
  for (const offset of [10, 44, 70]) {
    fill(context, palette, 'paper', box.x + offset, box.y + 5, 14, 10)
    fill(context, palette, 'ink', box.x + offset + 2, box.y + 8, 8, 1)
    fill(context, palette, 'ink', box.x + offset + 2, box.y + 11, 6, 1)
  }
  fill(context, palette, 'ink', box.x + 100, box.y + 7, 4, 5)
  fill(context, palette, 'paper', box.x + 103, box.y + 2, 1, 7)
  fill(context, palette, 'ember', box.x + 116, box.y + 4, 3, 3)
}

const paintForge: Painter = (context, palette, box) => {
  fill(context, palette, 'stone-dark', box.x, box.y, box.width, box.height)
  fill(context, palette, 'stone-mid', box.x + 1, box.y + 1, box.width - 2, box.height - 2)
  for (let line = 0; line < 4; line += 1) {
    fill(context, palette, 'stone-dark', box.x, box.y + line * 8, box.width, 1)
    for (let column = 0; column < box.width / 16; column += 1) {
      fill(context, palette, 'stone-dark', box.x + column * 16 + (line % 2) * 8, box.y + line * 8, 1, 8)
    }
  }
  fill(context, palette, 'ink', box.x + 10, box.y + 6, 38, 24)
  fill(context, palette, 'stone-light', box.x + 8, box.y + 4, 42, 2)
  fill(context, palette, 'stone-light', box.x + 8, box.y + 4, 2, 26)
  fill(context, palette, 'stone-light', box.x + 48, box.y + 4, 2, 26)
  fill(context, palette, 'ink', box.x + 60, box.y + 22, 14, 8)
  fill(context, palette, 'fire-b', box.x + 64, box.y + 24, 2, 2)
  fill(context, palette, 'iron', box.x + 84, box.y + 22, 14, 8)
  fill(context, palette, 'metal', box.x + 78, box.y + 16, 26, 6)
  fill(context, palette, 'metal', box.x + 104, box.y + 17, 6, 3)
  fill(context, palette, 'iron', box.x + 112, box.y + 10, 2, 18)
  fill(context, palette, 'iron', box.x + 116, box.y + 10, 2, 18)
  fill(context, palette, 'wood-mid', box.x + 119, box.y + 18, 8, 10)
  fill(context, palette, 'iron', box.x + 119, box.y + 21, 8, 1)
}

const paintCrystalTable: Painter = (context, palette, box) => {
  fill(context, palette, 'wood-dark', box.x, box.y, box.width, box.height)
  fill(context, palette, 'rug-a', box.x + 1, box.y + 1, box.width - 2, 22)
  fill(context, palette, 'rug-b', box.x + 1, box.y + 22, box.width - 2, 2)
  fill(context, palette, 'wood-mid', box.x + 1, box.y + 24, box.width - 2, 7)
  for (const [dx, dy] of [[10, 6], [24, 14], [88, 7], [98, 16]]) {
    fill(context, palette, 'ember', box.x + (dx ?? 0), box.y + (dy ?? 0), 2, 2)
  }
  fill(context, palette, 'paper', box.x + 68, box.y + 10, 6, 8)
  fill(context, palette, 'wood-dark', box.x + 50, box.y + 12, 12, 8)
  fill(context, palette, 'wood-mid', box.x + 48, box.y + 18, 16, 4)
  fillDisc(context, palette, 'crystal-a', box.x + 56, box.y + 8, 9)
  fillDisc(context, palette, 'crystal-b', box.x + 58, box.y + 10, 5)
  fill(context, palette, 'paper', box.x + 52, box.y + 3, 3, 2)
}

const paintCounterBase: Painter = (context, palette, box) => {
  fill(context, palette, 'wood-dark', box.x, box.y, box.width, box.height)
  fill(context, palette, 'wood-light', box.x + 1, box.y + 1, box.width - 2, 6)
  fill(context, palette, 'wood-mid', box.x + 1, box.y + 7, box.width - 2, 8)
  for (let column = 0; column < box.width / 16; column += 1) {
    fill(context, palette, 'wood-dark', box.x + column * 16, box.y + 7, 1, 8)
  }
}

const paintReceptionCounter: Painter = (context, palette, box) => {
  paintCounterBase(context, palette, box)
  fill(context, palette, 'paper', box.x + 24, box.y + 2, 10, 4)
  fill(context, palette, 'metal', box.x + 84, box.y + 2, 4, 3)
  fill(context, palette, 'iron', box.x + 83, box.y + 5, 6, 1)
  fill(context, palette, 'ink', box.x + 100, box.y + 2, 3, 4)
}

const paintBarCounter: Painter = (context, palette, box) => {
  paintCounterBase(context, palette, box)
  for (let mug = 0; mug < 5; mug += 1) {
    fill(context, palette, 'glass', box.x + 16 + mug * 32, box.y + 1, 3, 4)
    fill(context, palette, 'metal', box.x + 19 + mug * 32, box.y + 2, 1, 2)
  }
  fill(context, palette, 'iron', box.x + 1, box.y + 14, box.width - 2, 1)
}

const paintBarShelf: Painter = (context, palette, box) => {
  fill(context, palette, 'wood-dark', box.x, box.y, box.width, box.height)
  for (let shelf = 0; shelf < 2; shelf += 1) {
    const shelfTop = box.y + shelf * 16
    for (let bottle = 0; bottle < (box.width - 4) / 8; bottle += 1) {
      const color = BOTTLE_COLORS[(bottle * 2 + shelf) % BOTTLE_COLORS.length] ?? 'crystal-a'
      const height = 6 + ((bottle + shelf) % 3)
      fill(context, palette, color, box.x + 3 + bottle * 8, shelfTop + 13 - height, 4, height)
      fill(context, palette, 'glass', box.x + 4 + bottle * 8, shelfTop + 11 - height, 2, 2)
    }
    fill(context, palette, 'wood-light', box.x, shelfTop + 13, box.width, 3)
  }
}

const paintTable: Painter = (context, palette, box) => {
  fill(context, palette, 'wood-dark', box.x, box.y, box.width, box.height - 2)
  fill(context, palette, 'wood-light', box.x + 1, box.y + 1, box.width - 2, box.height - 9)
  fill(context, palette, 'wood-mid', box.x + 1, box.y + box.height - 8, box.width - 2, 5)
  const centerX = box.x + Math.floor(box.width / 2)
  const centerY = box.y + Math.floor(box.height / 2) - 4
  fill(context, palette, 'paper', centerX - 1, centerY, 2, 4)
  fill(context, palette, 'fire-a', centerX - 1, centerY - 2, 2, 2)
  fill(context, palette, 'glass', box.x + 6, centerY, 3, 4)
  fill(context, palette, 'glass', box.x + box.width - 10, centerY + 2, 3, 4)
}

const paintBarrel: Painter = (context, palette, box) => {
  fill(context, palette, 'wood-dark', box.x + 2, box.y + 1, 12, 14)
  fill(context, palette, 'wood-mid', box.x + 3, box.y + 2, 10, 12)
  fill(context, palette, 'wood-dark', box.x + 6, box.y + 2, 1, 12)
  fill(context, palette, 'wood-dark', box.x + 9, box.y + 2, 1, 12)
  fill(context, palette, 'iron', box.x + 2, box.y + 4, 12, 1)
  fill(context, palette, 'iron', box.x + 2, box.y + 11, 12, 1)
  fill(context, palette, 'wood-light', box.x + 3, box.y + 1, 10, 2)
}

const paintPlant: Painter = (context, palette, box) => {
  fill(context, palette, 'pot', box.x + 4, box.y + 10, 8, 5)
  fill(context, palette, 'wood-dark', box.x + 3, box.y + 9, 10, 1)
  fillDisc(context, palette, 'leaf-dark', box.x + 8, box.y + 6, 5)
  fillDisc(context, palette, 'leaf-light', box.x + 7, box.y + 5, 3)
  fill(context, palette, 'leaf-light', box.x + 3, box.y + 3, 3, 3)
  fill(context, palette, 'leaf-light', box.x + 11, box.y + 2, 3, 3)
}

const paintStool: Painter = (context, palette, box) => {
  fill(context, palette, 'wood-dark', box.x + 4, box.y + 7, 8, 4)
  fill(context, palette, 'wood-light', box.x + 5, box.y + 7, 6, 2)
  fill(context, palette, 'wood-dark', box.x + 5, box.y + 11, 1, 4)
  fill(context, palette, 'wood-dark', box.x + 10, box.y + 11, 1, 4)
}

const paintLamp: Painter = (context, palette, box) => {
  fill(context, palette, 'iron', box.x + 7, box.y + 5, 2, 11)
  fill(context, palette, 'iron', box.x + 4, box.y, 8, 2)
  fill(context, palette, 'ember', box.x + 5, box.y + 2, 6, 4)
  fill(context, palette, 'iron', box.x + 4, box.y + 6, 8, 1)
}

const paintRug: Painter = (context, palette, box) => {
  fill(context, palette, 'rug-a', box.x, box.y, box.width, box.height)
  fill(context, palette, 'rug-b', box.x + 2, box.y + 2, box.width - 4, box.height - 4)
  fill(context, palette, 'rug-a', box.x + 4, box.y + 4, box.width - 8, box.height - 8)
  for (let column = 8; column < box.width - 8; column += 8) {
    for (let line = 8; line < box.height - 8; line += 8) {
      fill(context, palette, 'rug-b', box.x + column, box.y + line, 2, 2)
    }
  }
}

export const FLOOR_PAINTERS: Record<FloorPropKind, Painter> = {
  rug: paintRug,
  bookshelves: paintBookshelves,
  desk: paintDesk,
  forge: paintForge,
  crystalTable: paintCrystalTable,
  receptionCounter: paintReceptionCounter,
  barShelf: paintBarShelf,
  barCounter: paintBarCounter,
  table: paintTable,
  barrel: paintBarrel,
  plant: paintPlant,
  stool: paintStool,
  lamp: paintLamp,
}
