import { useCallback, useEffect, useState } from 'react'
import type { Ledger } from '@shared/ledger'
import type { Loadable } from '@/lib/api'
import { ledgerQuery, startLoading, type LedgerState } from './ledger-logic'

export async function fetchLedger(dayOrDate: string): Promise<Ledger> {
  const response = await fetch(`/api/ledger?${ledgerQuery(dayOrDate)}`)
  if (!response.ok) {
    throw new Error('ledger_unavailable')
  }
  return response.json()
}

export function useLedger(date: string, active = true): Loadable<Ledger> & { refresh: () => void } {
  const [state, setState] = useState<LedgerState>({ data: null, error: null, loading: true, date })
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((previous) => previous + 1), [])
  useEffect(() => {
    if (!active) {
      return
    }
    let current = true
    setState((previous) => startLoading(previous, date))
    fetchLedger(date)
      .then((data) => current && setState({ data, error: null, loading: false, date }))
      .catch(() => current && setState((previous) => ({ ...previous, error: 'ledger_unavailable', loading: false })))
    return () => {
      current = false
    }
  }, [active, date, revision])
  const shown = state.date === date ? state : startLoading(state, date)
  return { data: shown.data, error: shown.error, loading: shown.loading, refresh }
}
