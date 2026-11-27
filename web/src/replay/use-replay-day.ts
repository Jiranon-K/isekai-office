import type { DayEvent } from '@shared/day-log'
import { useEffect, useState } from 'react'
import { fetchDayLog } from './replay-api'
import { buildReplayDay, type ReplayDay } from './replay-logic'

export type LoadedDay =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; events: DayEvent[]; day: ReplayDay }

const LOADING: LoadedDay = { status: 'loading' }

export function useReplayDay(date: string | null, loadId: number): LoadedDay {
  const [loaded, setLoaded] = useState<LoadedDay>(LOADING)
  useEffect(() => {
    if (date === null) {
      setLoaded(LOADING)
      return
    }
    let current = true
    setLoaded(LOADING)
    fetchDayLog(date)
      .then((log) => current && setLoaded({ status: 'ready', events: log.events, day: buildReplayDay(log.date, log.events) }))
      .catch(() => current && setLoaded({ status: 'error' }))
    return () => {
      current = false
    }
  }, [date, loadId])
  return loaded
}
