import { useCallback, useEffect, useState } from 'react'
import type { BoardSnapshot, CommandRequest, CommandResult, OfficeSnapshot, SessionDetail } from '@shared/types'

const BOARD_REFRESH_MS = 60_000

export type Loadable<T> = { data: T | null; error: string | null; loading: boolean }

export function useOfficeFeed(): Loadable<OfficeSnapshot> {
  const [state, setState] = useState<Loadable<OfficeSnapshot>>({ data: null, error: null, loading: true })
  useEffect(() => {
    const source = new EventSource('/api/office/events')
    source.onmessage = (event) => setState({ data: JSON.parse(event.data), error: null, loading: false })
    source.onerror = () => setState((previous) => ({ ...previous, error: 'server_unreachable', loading: false }))
    return () => source.close()
  }, [])
  return state
}

export function useBoard(active: boolean): Loadable<BoardSnapshot> & { refresh: () => void } {
  const [state, setState] = useState<Loadable<BoardSnapshot>>({ data: null, error: null, loading: true })
  const load = useCallback(async (force: boolean) => {
    setState((previous) => ({ ...previous, loading: true }))
    try {
      const response = await fetch(force ? '/api/board?refresh=1' : '/api/board')
      const data: BoardSnapshot = await response.json()
      setState({ data, error: data.error, loading: false })
    } catch {
      setState((previous) => ({ ...previous, error: 'server_unreachable', loading: false }))
    }
  }, [])
  useEffect(() => {
    if (!active) {
      return
    }
    void load(false)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load(false)
      }
    }, BOARD_REFRESH_MS)
    return () => clearInterval(timer)
  }, [active, load])
  return { ...state, refresh: () => void load(true) }
}

export async function fetchSession(id: string): Promise<SessionDetail> {
  const response = await fetch(`/api/session/${encodeURIComponent(id)}`)
  if (!response.ok) {
    throw new Error('session_unavailable')
  }
  return response.json()
}

export async function sendCommand(request: CommandRequest): Promise<CommandResult> {
  const response = await fetch('/api/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
  return response.json()
}
