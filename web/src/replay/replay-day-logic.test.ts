import { describe, expect, test } from 'bun:test'
import { LOADING, visibleDay, type LoadedDay } from './replay-day-logic'

const ready: LoadedDay = { status: 'ready', events: [], day: { date: 'old', start: 1, end: 2, watched: [], lanes: [] } }

describe('visibleDay', () => {
  test('shows the loaded day only for the date and load it was fetched for', () => {
    const stored = { date: '2026-11-26', loadId: 3, result: ready }
    expect(visibleDay(stored, '2026-11-26', 3)).toBe(ready)
  })

  test('shows loading at once for a new date, not the previous day', () => {
    const stored = { date: '2026-11-26', loadId: 3, result: ready }
    expect(visibleDay(stored, '2026-11-27', 4)).toBe(LOADING)
  })

  test('shows loading for the same date while a reload is pending', () => {
    const stored = { date: '2026-11-26', loadId: 3, result: ready }
    expect(visibleDay(stored, '2026-11-26', 4)).toBe(LOADING)
  })

  test('shows loading when there is no date or nothing was stored', () => {
    expect(visibleDay(null, '2026-11-26', 1)).toBe(LOADING)
    expect(visibleDay({ date: '2026-11-26', loadId: 1, result: ready }, null, 1)).toBe(LOADING)
  })
})
