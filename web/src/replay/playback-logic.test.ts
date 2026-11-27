import { describe, expect, test } from 'bun:test'
import { clampAt, snapsActors, stepPlayback } from './playback-logic'
import type { ReplayDay } from './replay-logic'

const day: ReplayDay = {
  date: '2026-11-27',
  start: 0,
  end: 10_000_000,
  watched: [
    { from: 0, to: 4_000_000 },
    { from: 6_000_000, to: 10_000_000 }
  ],
  lanes: []
}

describe('stepPlayback', () => {
  test('advances by elapsed time times the speed', () => {
    expect(stepPlayback(day, 1000, 100, 30)).toEqual({ at: 4000, ended: false })
  })

  test('skips a gap to the next watched moment', () => {
    expect(stepPlayback(day, 3_990_000, 1000, 30)).toEqual({ at: 6_000_000, ended: false })
  })

  test('starts from inside a gap by jumping out of it', () => {
    expect(stepPlayback(day, 5_000_000, 10, 1)).toEqual({ at: 6_000_000, ended: false })
  })

  test('stops at the end of the day', () => {
    expect(stepPlayback(day, 9_999_000, 1000, 30)).toEqual({ at: 10_000_000, ended: true })
  })

  test('ends when the rest of the day is a gap', () => {
    const trailing = { ...day, watched: [{ from: 0, to: 4_000_000 }] }
    expect(stepPlayback(trailing, 3_999_000, 1000, 30)).toEqual({ at: 10_000_000, ended: true })
  })
})

describe('snapsActors and clampAt', () => {
  test('snaps while seeking and at 120x only', () => {
    expect(snapsActors(1, false)).toBe(false)
    expect(snapsActors(30, false)).toBe(false)
    expect(snapsActors(120, false)).toBe(true)
    expect(snapsActors(1, true)).toBe(true)
  })

  test('keeps a moment inside the day', () => {
    expect(clampAt(day, -5)).toBe(0)
    expect(clampAt(day, 5)).toBe(5)
    expect(clampAt(day, 99_000_000)).toBe(10_000_000)
  })
})
