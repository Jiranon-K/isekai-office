import type { PanelId, Route } from '@/lib/route'

export type Surface = { kind: 'board' } | { kind: 'queue' } | { kind: 'agent' } | { kind: 'panel'; id: PanelId }

export type ReplaySurfaces = {
  board: boolean
  panel: PanelId | null
  queue: boolean
  liveAgentId: string | null
  acceptsPick: boolean
}

const REPLAY_PANEL: PanelId = 'hearth'

function panelFor(route: Route, replaying: boolean): PanelId | null {
  if (route.open === 'questBoard') {
    return null
  }
  if (replaying) {
    return route.open === REPLAY_PANEL ? REPLAY_PANEL : null
  }
  return route.open
}

export function replaySurfaces(route: Route, replaying: boolean): ReplaySurfaces {
  return {
    board: route.open === 'questBoard' && !replaying,
    panel: panelFor(route, replaying),
    queue: !replaying,
    liveAgentId: replaying ? null : route.agentId,
    acceptsPick: !replaying
  }
}

export function routeForReplay(route: Route): Route {
  return { open: route.open === REPLAY_PANEL ? REPLAY_PANEL : null, agentId: null }
}
