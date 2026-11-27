import type { DayLog, LogDays } from '@shared/day-log'
import { useEffect, useState } from 'react'
import type { Loadable } from '@/lib/api'

export async function fetchDayLog(date: string): Promise<DayLog> {
  const response = await fetch(`/api/log/day?date=${encodeURIComponent(date)}`)
  if (!response.ok) {
    throw new Error('day_unavailable')
  }
  return response.json()
}

export function useLogDays(active: boolean): Loadable<LogDays> {
  const [state, setState] = useState<Loadable<LogDays>>({ data: null, error: null, loading: true })
  useEffect(() => {
    if (!active) {
      return
    }
    let current = true
    fetch('/api/log/days')
      .then((response) => response.json())
      .then((data: LogDays) => current && setState({ data, error: null, loading: false }))
      .catch(() => current && setState({ data: null, error: 'server_unreachable', loading: false }))
    return () => {
      current = false
    }
  }, [active])
  return state
}
