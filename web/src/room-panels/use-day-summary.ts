import { useEffect, useState } from 'react'
import type { Loadable } from '@/lib/api'
import { fetchLedger } from '@/ledger/use-ledger'
import { fetchDayLog } from '@/replay/replay-api'
import { summarise, type DaySummary } from './summary-logic'

async function fetchSummary(date: string, ledgerDay: string): Promise<DaySummary> {
  const [day, ledger] = await Promise.all([fetchDayLog(date), fetchLedger(ledgerDay).catch(() => null)])
  return summarise(day, ledger)
}

export function useDaySummary(date: string, ledgerDay: string): Loadable<DaySummary> {
  const [state, setState] = useState<Loadable<DaySummary>>({ data: null, error: null, loading: true })
  useEffect(() => {
    let current = true
    setState({ data: null, error: null, loading: true })
    fetchSummary(date, ledgerDay)
      .then((data) => current && setState({ data, error: null, loading: false }))
      .catch(() => current && setState({ data: null, error: 'day_unavailable', loading: false }))
    return () => {
      current = false
    }
  }, [date, ledgerDay])
  return state
}
