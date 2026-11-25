import type { ColorName } from './office-palette'

export const MANA_WARN_RATIO = 0.7
export const MANA_HIGH_RATIO = 0.85

export function manaRatio(contextTokens: number | null, contextWindow: number): number | null {
  if (contextTokens === null || !(contextWindow > 0)) {
    return null
  }
  return Math.min(Math.max(contextTokens / contextWindow, 0), 1)
}

export type ManaLevel = 'low' | 'warn' | 'high'

export function manaLevel(ratio: number): ManaLevel {
  if (ratio >= MANA_HIGH_RATIO) {
    return 'high'
  }
  return ratio >= MANA_WARN_RATIO ? 'warn' : 'low'
}

export function manaColor(ratio: number): ColorName {
  return `mana-${manaLevel(ratio)}`
}

export function peakLoad(loads: readonly (number | null)[], contextWindow: number): number | null {
  const ratios = loads.map((load) => manaRatio(load, contextWindow)).filter((ratio) => ratio !== null)
  return ratios.length === 0 ? null : Math.max(...ratios)
}
