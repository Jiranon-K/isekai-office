import { describe, expect, test } from 'bun:test'
import { gaps, percentOf, spanStyle } from './replay-geometry'
import type { ReplayDay } from './replay-logic'

const day: ReplayDay = {
  date: '2026-11-27',
  start: 1000,
  end: 2000,
  watched: [
    { from: 1100, to: 1300 },
    { from: 1600, to: 1900 }
  ],
  lanes: []
}

describe('gaps', () => {
  test('returns every stretch that was not recorded, edges included', () => {
    expect(gaps(day)).toEqual([
      { from: 1000, to: 1100 },
      { from: 1300, to: 1600 },
      { from: 1900, to: 2000 }
    ])
  })

  test('makes the whole day a gap when nothing was watched', () => {
    expect(gaps({ ...day, watched: [] })).toEqual([{ from: 1000, to: 2000 }])
  })

  test('has no gap when the day is fully watched or empty', () => {
    expect(gaps({ ...day, watched: [{ from: 1000, to: 2000 }] })).toEqual([])
    expect(gaps({ ...day, start: 0, end: 0, watched: [] })).toEqual([])
  })
})

describe('percentOf and spanStyle', () => {
  test('maps a moment to a share of the day and clamps it', () => {
    expect(percentOf(day, 1250)).toBe(25)
    expect(percentOf(day, 0)).toBe(0)
    expect(percentOf(day, 5000)).toBe(100)
  })

  test('is zero on a day with no length', () => {
    expect(percentOf({ ...day, start: 5, end: 5 }, 5)).toBe(0)
  })

  test('turns a span into a left offset and a width', () => {
    expect(spanStyle(day, { from: 1100, to: 1300 })).toEqual({ left: '10%', width: '20%' })
  })
})
