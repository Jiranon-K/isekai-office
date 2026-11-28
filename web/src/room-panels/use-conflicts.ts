import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileConflict } from '@shared/conflicts'
import type { OfficeAgent } from '@shared/types'
import { fetchConflicts } from '@/lib/api'
import { activeConflictAgentIds, conflictRevisionKey } from './conflict-logic'

export type ConflictsState = {
  conflicts: readonly FileConflict[]
  agentIds: ReadonlySet<string>
  loading: boolean
  error: string | null
  refresh(): void
}

export function useConflicts(agents: readonly OfficeAgent[], enabled: boolean): ConflictsState {
  const [conflicts, setConflicts] = useState<readonly FileConflict[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const revisionKey = useMemo(() => conflictRevisionKey(agents), [agents])

  const load = useCallback(() => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    fetchConflicts()
      .then((snapshot) => {
        if (requestIdRef.current !== requestId) {
          return
        }
        setConflicts(snapshot.conflicts)
        setError(null)
        setLoading(false)
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) {
          return
        }
        setConflicts([])
        setError('conflicts_unavailable')
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!enabled || revisionKey === '') {
      requestIdRef.current += 1
      setConflicts([])
      setError(null)
      setLoading(false)
      return
    }
    load()
    return () => {
      requestIdRef.current += 1
    }
  }, [enabled, revisionKey, load])

  const refresh = useCallback(() => {
    if (!enabled) {
      return
    }
    load()
  }, [enabled, load])

  const agentIds = useMemo(() => activeConflictAgentIds(conflicts, agents), [conflicts, agents])

  return { conflicts, agentIds, loading, error, refresh }
}
