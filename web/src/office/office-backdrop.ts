import type { World } from '@/lib/theme'
import { createCanvas, getContext } from './office-draw'
import { ROOM_HEIGHT, ROOM_WIDTH } from './office-layout'

const backdrops = new Map<World, HTMLImageElement | null>()
const pending = new Map<World, Promise<void>>()

export function backdropUrl(world: World): string {
  return `/assets/rooms/${world}.png`
}

export function loadBackdrop(world: World, onReady: () => void): void {
  if (backdrops.has(world) || pending.has(world)) {
    return
  }
  const image = new Image()
  image.src = backdropUrl(world)
  const loading = image
    .decode()
    .then(() => {
      const fits = image.naturalWidth === ROOM_WIDTH && image.naturalHeight === ROOM_HEIGHT
      backdrops.set(world, fits ? image : null)
    })
    .catch(() => {
      backdrops.set(world, null)
    })
    .finally(() => {
      pending.delete(world)
      onReady()
    })
  pending.set(world, loading)
}

export function backdropLayer(world: World): HTMLCanvasElement | null {
  const image = backdrops.get(world)
  if (!image) {
    return null
  }
  const canvas = createCanvas(ROOM_WIDTH, ROOM_HEIGHT)
  getContext(canvas).drawImage(image, 0, 0)
  return canvas
}
