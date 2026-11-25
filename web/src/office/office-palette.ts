export const COLOR_NAMES = [
  'floor-a',
  'floor-b',
  'floor-line',
  'wall-top',
  'wall-face',
  'wall-base',
  'wall-line',
  'rug-a',
  'rug-b',
  'accent',
  'accent-dark',
  'glow',
  'wood-light',
  'wood-mid',
  'wood-dark',
  'stone-light',
  'stone-mid',
  'stone-dark',
  'metal',
  'iron',
  'fire-a',
  'fire-b',
  'fire-core',
  'ember',
  'crystal-a',
  'crystal-b',
  'paper',
  'ink',
  'book-red',
  'book-teal',
  'book-amber',
  'book-violet',
  'leaf-light',
  'leaf-dark',
  'pot',
  'glass',
  'shade',
  'shadow',
  'bubble',
  'bubble-edge',
  'alert-waiting',
  'alert-blocked',
  'mana-low',
  'mana-warn',
  'mana-high',
  'mana-empty',
  'sweat',
  'plate',
  'plate-text',
  'plate-muted',
  'outline',
  'boots',
  'skin-1',
  'skin-2',
  'skin-3',
  'hair-1',
  'hair-2',
  'hair-3',
  'hair-4',
  'knight-body',
  'knight-trim',
  'knight-accent',
  'knight-legs',
  'mage-body',
  'mage-trim',
  'mage-accent',
  'mage-legs',
  'ranger-body',
  'ranger-trim',
  'ranger-accent',
  'ranger-legs',
  'alchemist-body',
  'alchemist-trim',
  'alchemist-accent',
  'alchemist-legs',
  'bartender-body',
  'bartender-trim',
  'bartender-accent',
  'bartender-legs',
  'receptionist-body',
  'receptionist-trim',
  'receptionist-accent',
  'receptionist-legs',
] as const

export type ColorName = (typeof COLOR_NAMES)[number]

export type OfficePalette = {
  color: (name: ColorName) => string
  font: string
}

const FALLBACK_COLOR = 'transparent'
const FALLBACK_FONT = 'monospace'

export function readPalette(): OfficePalette {
  const styles = getComputedStyle(document.documentElement)
  const colors = new Map<string, string>()
  for (const name of COLOR_NAMES) {
    colors.set(name, styles.getPropertyValue(`--office-${name}`).trim())
  }
  const font = styles.getPropertyValue('--office-font').trim() || FALLBACK_FONT
  return {
    color: (name) => colors.get(name) || FALLBACK_COLOR,
    font,
  }
}
