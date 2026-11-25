import type { OfficeAgent, SessionDetail } from '@shared/types'
import { useCallback, useEffect, useState } from 'react'
import { fetchSession, type Loadable } from '@/lib/api'

const SESSION_REFRESH_MS = 5000

export function useSession(agent: OfficeAgent): Loadable<SessionDetail> & { retry(): void } {
  const [state, setState] = useState<Loadable<SessionDetail>>({ data: null, error: null, loading: true })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setState({ data: null, error: null, loading: true })
  }, [agent.id])

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      try {
        const data = await fetchSession(agent.id)
        if (!cancelled) {
          setState({ data, error: null, loading: false })
        }
      } catch (error) {
        if (!cancelled) {
          const reason = error instanceof Error ? error.message : 'session_unavailable'
          setState((previous) => ({ ...previous, error: reason, loading: false }))
        }
      }
    }
    void load()
    const timer = setInterval(() => void load(), SESSION_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [agent.id, agent.state, agent.updatedAt, attempt])

  const retry = useCallback(() => {
    setState((previous) => ({ ...previous, loading: true }))
    setAttempt((current) => current + 1)
  }, [])

  return { ...state, retry }
}
