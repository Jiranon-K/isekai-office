import type { OfficeAgent, SessionDetail } from '@shared/types'
import { useCallback, useEffect, useState } from 'react'
import { fetchSession, type Loadable } from '@/lib/api'

const SESSION_REFRESH_MS = 5000

type LoadedSession = Loadable<SessionDetail> & { loadedFor: number | null }

const EMPTY_SESSION: LoadedSession = { data: null, error: null, loading: true, loadedFor: null }

export function useSession(agent: OfficeAgent): LoadedSession & { retry(): void } {
  const [state, setState] = useState<LoadedSession>(EMPTY_SESSION)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setState(EMPTY_SESSION)
  }, [agent.id])

  useEffect(() => {
    let cancelled = false
    const requestedFor = agent.updatedAt
    async function load(): Promise<void> {
      try {
        const data = await fetchSession(agent.id)
        if (!cancelled) {
          setState({ data, error: null, loading: false, loadedFor: requestedFor })
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
