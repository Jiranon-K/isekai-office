import type { DayEvent } from '@shared/day-log'
import type { ReplayDay } from './replay-logic'

export type LoadedDay =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; events: DayEvent[]; day: ReplayDay }

export type StoredDay = { date: string; loadId: number; result: LoadedDay }

export const LOADING: LoadedDay = { status: 'loading' }

export function visibleDay(stored: StoredDay | null, date: string | null, loadId: number): LoadedDay {
  if (stored === null || date === null || stored.date !== date || stored.loadId !== loadId) {
    return LOADING
  }
  return stored.result
}
