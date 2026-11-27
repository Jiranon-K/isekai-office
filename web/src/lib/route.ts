import { isDayDate } from '@shared/day-log'
import { HOTSPOTS, type HotspotId } from '@/office/scene/hotspots'

export type PanelId = Exclude<HotspotId, 'windows'>

export type Route = { open: PanelId | null; agentId: string | null }

const BOARD: PanelId = 'questBoard'

export function isPanelId(value: string | null): value is PanelId {
  return HOTSPOTS.some((hotspot) => hotspot.id === value && hotspot.action.kind === 'panel')
}

function readOpen(params: URLSearchParams): PanelId | null {
  if (params.get('view') === 'board') {
    return BOARD
  }
  const open = params.get('open')
  return isPanelId(open) ? open : null
}

export function parseRoute(search: string): Route {
  const params = new URLSearchParams(search)
  const agentId = params.get('agent') || null
  const open = readOpen(params)
  if (agentId !== null && open !== BOARD) {
    return { open: null, agentId }
  }
  return { open, agentId }
}

export function formatRoute(route: Route): string {
  const params = new URLSearchParams()
  if (route.open === BOARD) {
    params.set('view', 'board')
  }
  if (route.open !== null && route.open !== BOARD) {
    params.set('open', route.open)
  }
  if (route.agentId) {
    params.set('agent', route.agentId)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function togglePanel(route: Route, id: PanelId): Route {
  if (route.open === id) {
    return { ...route, open: null }
  }
  return { open: id, agentId: null }
}

export function openPanel(route: Route, id: PanelId): Route {
  return route.open === id ? route : { open: id, agentId: null }
}

export function closePanel(route: Route): Route {
  return { ...route, open: null }
}

export function selectAgent(route: Route, agentId: string | null): Route {
  if (agentId === null) {
    return { ...route, agentId: null }
  }
  return { open: route.open === BOARD ? BOARD : null, agentId }
}

const BOARD_KEYS = ['tab', 'space', 'sprint', 'q']

export function mergeQuery(search: string, route: Route): string {
  const current = new URLSearchParams(search)
  const next = new URLSearchParams(formatRoute(route))
  for (const key of route.open === BOARD ? BOARD_KEYS : []) {
    const value = current.get(key)
    if (value) {
      next.set(key, value)
    }
  }
  keepReplay(current, next)
  const query = next.toString()
  return query ? `?${query}` : ''
}

export type ReplayRoute = { date: string; at: number | null }

const REPLAY_KEYS = ['replay', 'at']

export function parseReplay(search: string): ReplayRoute | null {
  const params = new URLSearchParams(search)
  const date = params.get('replay')
  if (!isDayDate(date)) {
    return null
  }
  const at = Number(params.get('at'))
  return { date, at: params.get('at') !== null && Number.isInteger(at) && at >= 0 ? at : null }
}

function keepReplay(current: URLSearchParams, next: URLSearchParams): void {
  const replay = parseReplay(current.toString())
  if (replay === null) {
    return
  }
  next.set('replay', replay.date)
  if (replay.at !== null) {
    next.set('at', String(replay.at))
  }
}

export function withReplay(search: string, replay: ReplayRoute | null): string {
  const params = new URLSearchParams(search)
  for (const key of REPLAY_KEYS) {
    params.delete(key)
  }
  if (replay !== null) {
    params.set('replay', replay.date)
  }
  if (replay !== null && replay.at !== null) {
    params.set('at', String(Math.round(replay.at)))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}
