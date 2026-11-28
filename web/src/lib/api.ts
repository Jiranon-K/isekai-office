import { useCallback, useEffect, useState } from 'react'
import { shouldPoll } from '@/alerts/pipeline-logic'
import { publishSourceCaps } from './source-caps'
import type { AgentDiff, DiffSummaryResponse } from '@shared/diff'
import type { OrderChange, OrderResult, StandingOrders } from '@shared/orders'
import type {
  BoardSnapshot,
  CommandRequest,
  CommandResult,
  GuildLog,
  OfficeSnapshot,
  OrcaRepo,
  SessionDetail,
  SpawnRequest,
  SpawnResult
} from '@shared/types'

const BOARD_REFRESH_MS = 60_000

export type Loadable<T> = { data: T | null; error: string | null; loading: boolean }

export function useOfficeFeed(): Loadable<OfficeSnapshot> {
  const [state, setState] = useState<Loadable<OfficeSnapshot>>({ data: null, error: null, loading: true })
  useEffect(() => {
    const source = new EventSource('/api/office/events')
    source.onmessage = (event) => {
      const data: OfficeSnapshot = JSON.parse(event.data)
      publishSourceCaps(data.caps)
      setState({ data, error: null, loading: false })
    }
    source.onerror = () => setState((previous) => ({ ...previous, error: 'server_unreachable', loading: false }))
    return () => source.close()
  }, [])
  return state
}

export function useBoard(active: boolean, keepPolling = false): Loadable<BoardSnapshot> & { refresh: () => void } {
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
      if (shouldPoll(keepPolling, document.visibilityState)) {
        void load(false)
      }
    }, BOARD_REFRESH_MS)
    return () => clearInterval(timer)
  }, [active, keepPolling, load])
  return { ...state, refresh: () => void load(true) }
}

export function useGuildLog(active: boolean, revision: number): Loadable<GuildLog> {
  const [state, setState] = useState<Loadable<GuildLog>>({ data: null, error: null, loading: true })
  useEffect(() => {
    if (!active) {
      return
    }
    let current = true
    fetch('/api/log')
      .then((response) => response.json())
      .then((data: GuildLog) => current && setState({ data, error: null, loading: false }))
      .catch(() => current && setState((previous) => ({ ...previous, error: 'server_unreachable', loading: false })))
    return () => {
      current = false
    }
  }, [active, revision])
  return state
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

export function useRepos(): Loadable<OrcaRepo[]> {
  const [state, setState] = useState<Loadable<OrcaRepo[]>>({ data: null, error: null, loading: true })
  useEffect(() => {
    let current = true
    fetch('/api/repos')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('repos_unavailable'))))
      .then((body: { repos: OrcaRepo[] }) => current && setState({ data: body.repos, error: null, loading: false }))
      .catch(() => current && setState({ data: null, error: 'repos_unavailable', loading: false }))
    return () => {
      current = false
    }
  }, [])
  return state
}

export async function sendSpawn(request: SpawnRequest): Promise<SpawnResult> {
  try {
    const response = await fetch('/api/spawn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })
    return await response.json()
  } catch {
    return { ok: false, error: 'server_unreachable' }
  }
}

export async function fetchOrders(agentId: string): Promise<StandingOrders> {
  const response = await fetch(`/api/orders/${encodeURIComponent(agentId)}`)
  if (!response.ok) {
    throw new Error('orders_unavailable')
  }
  return response.json()
}

export async function sendOrderChange(change: OrderChange): Promise<OrderResult> {
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(change)
    })
    return await response.json()
  } catch {
    return { ok: false, error: 'server_unreachable' }
  }
}

export async function fetchAgentDiff(agentId: string): Promise<AgentDiff> {
  const response = await fetch(`/api/diff/${encodeURIComponent(agentId)}`)
  if (!response.ok) {
    throw new Error('diff_unavailable')
  }
  return response.json()
}

export async function fetchDiffSummaries(agentIds: readonly string[]): Promise<DiffSummaryResponse> {
  if (agentIds.length === 0) {
    return { summaries: [] }
  }
  const query = new URLSearchParams({ ids: agentIds.join(',') })
  const response = await fetch(`/api/diff-summary?${query}`)
  if (!response.ok) {
    throw new Error('diff_summary_unavailable')
  }
  return response.json()
}
