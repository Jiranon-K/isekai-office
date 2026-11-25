import { describe, expect, test } from 'bun:test'
import { parseTheme, toggleMode, WORLDS } from './theme'

describe('parseTheme', () => {
  test('every known world is kept', () => {
    const parsed = WORLDS.map((world) => parseTheme(JSON.stringify({ world, mode: 'day' })).world)
    expect(parsed).toEqual([...WORLDS])
  })

  test('meadow at night survives a reload', () => {
    expect(parseTheme(JSON.stringify({ world: 'meadow', mode: 'night' }))).toEqual({ world: 'meadow', mode: 'night' })
  })

  test('an unknown world falls back to tavern', () => {
    expect(parseTheme(JSON.stringify({ world: 'volcano', mode: 'night' }))).toEqual({ world: 'tavern', mode: 'night' })
  })

  test('a broken stored value falls back to tavern by day', () => {
    expect(parseTheme('{not json')).toEqual({ world: 'tavern', mode: 'day' })
  })
})

describe('toggleMode', () => {
  test('day becomes night and keeps the world', () => {
    expect(toggleMode({ world: 'grove', mode: 'day' })).toEqual({ world: 'grove', mode: 'night' })
  })

  test('night becomes day', () => {
    expect(toggleMode({ world: 'keep', mode: 'night' }).mode).toBe('day')
  })
})
