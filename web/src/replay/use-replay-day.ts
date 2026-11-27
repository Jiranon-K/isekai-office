import { useEffect, useState } from 'react'
import { fetchDayLog } from './replay-api'
import { LOADING, visibleDay, type LoadedDay, type StoredDay } from './replay-day-logic'
import { buildReplayDay } from './replay-logic'

export type { LoadedDay } from './replay-day-logic'

export function useReplayDay(date: string | null, loadId: number): LoadedDay {
  const [stored, setStored] = useState<StoredDay | null>(null)
  useEffect(() => {
    if (date === null) {
      setStored(null)
      return
    }
    let current = true
    function keep(result: LoadedDay): void {
      if (current && date !== null) {
        setStored({ date, loadId, result })
      }
    }
    fetchDayLog(date)
      .then((log) => keep({ status: 'ready', events: log.events, day: buildReplayDay(log.date, log.events) }))
      .catch(() => keep({ status: 'error' }))
    return () => {
      current = false
    }
  }, [date, loadId])
  return date === null ? LOADING : visibleDay(stored, date, loadId)
}
