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
  const query = next.toString()
  return query ? `?${query}` : ''
}
