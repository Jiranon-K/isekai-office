import { useCallback, useEffect, useState } from 'react'
import type { Ledger } from '@shared/ledger'
import type { Loadable } from '@/lib/api'

export async function fetchLedger(date: string): Promise<Ledger> {
  const response = await fetch(`/api/ledger?date=${encodeURIComponent(date)}`)
  if (!response.ok) {
    throw new Error('ledger_unavailable')
  }
  return response.json()
}

export function useLedger(date: string, active = true): Loadable<Ledger> & { refresh: () => void } {
  const [state, setState] = useState<Loadable<Ledger>>({ data: null, error: null, loading: true })
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((previous) => previous + 1), [])
  useEffect(() => {
    if (!active) {
      return
    }
    let current = true
    setState((previous) => ({ ...previous, loading: true }))
    fetchLedger(date)
      .then((data) => current && setState({ data, error: null, loading: false }))
      .catch(() => current && setState((previous) => ({ ...previous, error: 'ledger_unavailable', loading: false })))
    return () => {
      current = false
    }
  }, [active, date, revision])
  return { ...state, refresh }
}
