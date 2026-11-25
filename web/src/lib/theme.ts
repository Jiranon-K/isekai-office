import { useCallback, useEffect, useState } from 'react'

export const WORLDS = ['tavern', 'grove', 'keep', 'meadow'] as const
export type World = (typeof WORLDS)[number]
export type Mode = 'day' | 'night'
export type Theme = { world: World; mode: Mode }

const STORAGE_KEY = 'isekai-office-theme'
const DEFAULT_THEME: Theme = { world: 'tavern', mode: 'day' }

export function parseTheme(raw: string | null): Theme {
  if (!raw) {
    return DEFAULT_THEME
  }
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) {
      return DEFAULT_THEME
    }
    const world = WORLDS.find((known) => known === Reflect.get(value, 'world')) ?? DEFAULT_THEME.world
    const mode: Mode = Reflect.get(value, 'mode') === 'night' ? 'night' : 'day'
    return { world, mode }
  } catch {
    return DEFAULT_THEME
  }
}

export const WORLD_LABELS: Record<World, string> = {
  tavern: 'Guild Tavern',
  grove: 'Elven Grove',
  keep: "Demon Lord's Keep",
  meadow: 'Starfall Meadow'
}

export function toggleMode(theme: Theme): Theme {
  return { ...theme, mode: theme.mode === 'night' ? 'day' : 'night' }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.dataset.world = theme.world
  root.classList.toggle('dark', theme.mode === 'night')
}

export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setThemeState] = useState(() => parseTheme(localStorage.getItem(STORAGE_KEY)))
  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme))
  }, [theme])
  const setTheme = useCallback((next: Theme) => setThemeState(next), [])
  return [theme, setTheme]
}
