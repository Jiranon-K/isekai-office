import type { ColorName, OfficePalette } from './office-palette'

export type PixelBox = { x: number; y: number; width: number; height: number }

export type Painter = (context: CanvasRenderingContext2D, palette: OfficePalette, box: PixelBox) => void

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('2D canvas context is unavailable')
  }
  context.imageSmoothingEnabled = false
  return context
}

export function fill(
  context: CanvasRenderingContext2D,
  palette: OfficePalette,
  color: ColorName,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.fillStyle = palette.color(color)
  context.fillRect(x, y, width, height)
}

export function fillDisc(
  context: CanvasRenderingContext2D,
  palette: OfficePalette,
  color: ColorName,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  context.fillStyle = palette.color(color)
  for (let offset = -radius; offset <= radius; offset += 1) {
    const half = Math.floor(Math.sqrt(radius * radius + radius * 0.5 - offset * offset))
    context.fillRect(centerX - half, centerY + offset, half * 2 + 1, 1)
  }
}
