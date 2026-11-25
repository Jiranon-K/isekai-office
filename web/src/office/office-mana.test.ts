import { describe, expect, test } from 'bun:test'
import { manaColor, manaRatio, peakLoad } from './office-mana'

describe('mana ratio', () => {
  test('is the share of the window the session holds', () => {
    expect(manaRatio(250_000, 1_000_000)).toBe(0.25)
  })

  test('is clamped to one when the session holds more than the window', () => {
    expect(manaRatio(1_500_000, 1_000_000)).toBe(1)
  })

  test('is null when the load is unknown or the window is not set', () => {
    expect(manaRatio(null, 1_000_000)).toBeNull()
    expect(manaRatio(5, 0)).toBeNull()
  })
})

describe('mana color', () => {
  test('stays calm below 70 percent', () => {
    expect(manaColor(0.69)).toBe('mana-low')
  })

  test('warns from 70 percent', () => {
    expect(manaColor(0.7)).toBe('mana-warn')
    expect(manaColor(0.84)).toBe('mana-warn')
  })

  test('alarms from 85 percent', () => {
    expect(manaColor(0.85)).toBe('mana-high')
  })
})

describe('peak load', () => {
  test('is the highest share among the sessions', () => {
    expect(peakLoad([100_000, 900_000, null], 1_000_000)).toBe(0.9)
  })

  test('is null when no session reports a load', () => {
    expect(peakLoad([null], 1_000_000)).toBeNull()
    expect(peakLoad([], 1_000_000)).toBeNull()
  })
})
