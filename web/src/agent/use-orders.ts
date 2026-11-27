import type { OrderChange, StandingOrders } from '@shared/orders'
import { useCallback, useEffect, useState } from 'react'
import { fetchOrders, sendOrderChange, type Loadable } from '@/lib/api'

export type OrdersState = Loadable<StandingOrders> & { change(order: Omit<OrderChange, 'agentId'>): Promise<string | null> }

export function useOrders(agentId: string): OrdersState {
  const [state, setState] = useState<Loadable<StandingOrders>>({ data: null, error: null, loading: true })
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    setState((previous) => ({ ...previous, loading: true }))
    let current = true
    fetchOrders(agentId)
      .then((data) => current && setState({ data, error: null, loading: false }))
      .catch(() => current && setState({ data: null, error: 'server_unreachable', loading: false }))
    return () => {
      current = false
    }
  }, [agentId, revision])

  const change = useCallback(
    async (order: Omit<OrderChange, 'agentId'>): Promise<string | null> => {
      const result = await sendOrderChange({ agentId, ...order })
      setRevision((previous) => previous + 1)
      return result.ok ? null : (result.error ?? 'write_failed')
    },
    [agentId]
  )

  return { ...state, change }
}
