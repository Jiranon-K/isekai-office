import { describe, expect, test } from 'bun:test'
import { hearthGlowAlpha } from './hearth-glow'

describe('hearthGlowAlpha', () => {
  test('with motion off the glow rests at a strong red, not a faint tint', () => {
    expect(hearthGlowAlpha(0, false)).toBe(0.7)
    expect(hearthGlowAlpha(123, false)).toBe(0.7)
  })

  test('while animating the glow pulses between 0.5 and 0.85 and never fades out', () => {
    const samples = Array.from({ length: 200 }, (_, index) => hearthGlowAlpha(index * 0.05, true))
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.5)
    expect(Math.max(...samples)).toBeLessThanOrEqual(0.85)
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.3)
  })
})
