import { describe, expect, test } from 'bun:test'
import { ROOM_WIDTH } from './office-layout'
import { COLOR_NAMES } from './office-palette'
import { HOTSPOTS, hotspotBounds } from './office-hotspots'
import { canvasHeight, computeView, scrollToShow, toScreenBox } from './office-view'

describe('computeView', () => {
  const viewports: [number, number, number][] = [
    [1440, 900, 2],
    [1440, 670, 2],
    [2560, 1080, 1],
    [1024, 768, 1],
    [390, 844, 3],
  ]

  function viewFor(width: number, height: number, dpr: number): ReturnType<typeof computeView> {
    return computeView(width, canvasHeight(width, height), dpr)
  }

  test('the room fills the full width of every screen', () => {
    const gaps = viewports.filter(([width, height, dpr]) => {
      const view = viewFor(width, height, dpr)
      return Math.abs(view.offsetX) > 1 || Math.abs(ROOM_WIDTH * view.scale - view.width) > 1
    })
    expect(gaps).toEqual([])
  })

  test('the canvas grows taller than a wide screen so nothing is cropped', () => {
    expect(canvasHeight(1440, 670)).toBe(864)
    expect(canvasHeight(390, 844)).toBe(844)
  })

  test('keeps every hotspot fully on the canvas', () => {
    const hidden = viewports.flatMap(([width, height, dpr]) => {
      const view = viewFor(width, height, dpr)
      return HOTSPOTS.filter((hotspot) => {
        const bounds = hotspotBounds(hotspot)
        const box = toScreenBox(view, bounds)
        return Math.abs(box.width * dpr - bounds.width * view.scale) > 1 || Math.abs(box.height * dpr - bounds.height * view.scale) > 1
      }).map((hotspot) => `${width}x${height}:${hotspot.id}`)
    })
    expect(hidden).toEqual([])
  })
})

describe('scrollToShow', () => {
  test('stays put when the object is already in view', () => {
    expect(scrollToShow({ left: 0, top: 100, width: 50, height: 50 }, 40, 600)).toBe(40)
  })

  test('centres an object that is below the fold', () => {
    expect(scrollToShow({ left: 0, top: 800, width: 50, height: 60 }, 0, 670)).toBe(495)
  })

  test('never scrolls above the top', () => {
    expect(scrollToShow({ left: 0, top: 0, width: 50, height: 40 }, 200, 670)).toBe(0)
  })
})

describe('toScreenBox', () => {
  test('gives CSS pixels for a room rect', () => {
    const view = computeView(1280, 768, 2)
    expect(toScreenBox(view, { x: 320, y: 192, width: 64, height: 32 })).toEqual({ left: 640, top: 384, width: 128, height: 64 })
  })

  test('keeps a cropped rect inside the viewport', () => {
    const view = computeView(640, 384, 1)
    const box = toScreenBox(view, { x: -20, y: 0, width: 36, height: 48 })
    expect(box).toEqual({ left: 0, top: 0, width: 16, height: 48 })
  })
})

describe('office tokens', () => {
  test('every colour the canvas reads is declared in the token file', async () => {
    const css = await Bun.file(new URL('./office-tokens.css', import.meta.url)).text()
    const missing = COLOR_NAMES.filter((name) => !css.includes(`--office-${name}:`))
    expect(missing).toEqual([])
  })
})
