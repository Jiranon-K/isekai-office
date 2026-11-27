import type { OfficeAgent, SessionDetail } from '@shared/types'
import { useEffect, useState } from 'react'
import { fetchSession } from '@/lib/api'

export type PrefetchedSession = { agentId: string; detail: SessionDetail }

export function usePrefetchedSession(agent: OfficeAgent | null): PrefetchedSession | null {
  const [prefetched, setPrefetched] = useState<PrefetchedSession | null>(null)
  const agentId = agent?.id ?? null
  const updatedAt = agent?.updatedAt ?? null

  useEffect(() => {
    if (agentId === null) {
      return
    }
    let cancelled = false
    fetchSession(agentId)
      .then((detail) => {
        if (!cancelled) {
          setPrefetched({ agentId, detail })
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [agentId, updatedAt])

  return prefetched
}
