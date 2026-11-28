import type { OfficeAgent } from '@shared/types'
import { createNpcActors, markConflicts, markParties, markQuiet, syncActors, updateActors, type Actor } from './actors'
import type { Mode, World } from '@/lib/theme'
import { backdropLayer, loadBackdrop } from '../draw/backdrop'
import { countAgents } from '@/lib/agent-counts'
import {
  AGENT_HALF_WIDTH,
  AGENT_HEIGHT,
  PULSE_MS,
  agentHitRect,
  pulseAlpha,
  resolvePick,
  type HotspotId,
  type PickTarget,
  type RoomRect,
} from './hotspots'
import { createWalkGrid } from './layout'
import type { GroupId } from './stations'
import { peakLoad } from './mana'
import { readPalette, type OfficePalette } from '../draw/palette'
import { renderFrame, type RoomLayers } from '../draw/render'
import type { Signals } from '../draw/signals'
import { buildRoomLayer, buildShadeLayer } from '../draw/room'
import { computeView, toRoomPoint, type ViewMetrics } from './view'
import { getContext } from '../draw/draw'
import type { Party } from '@/party/party-logic'
import { ringedPartyKey } from '@/party/ring-logic'
import { repoTagHitBottom } from '../draw/repo-tag'

export type OfficeInput = {
  agents: readonly OfficeAgent[]
  sourceReady: boolean
  contextWindow: number
  quiet: ReadonlyMap<string, number>
  selectedId: string | null
  world: World
  mode: Mode
  paused: boolean
  boardWaiting: number
  openHotspot: HotspotId | null
  partyByAgent: ReadonlyMap<string, Party>
  conflictIds?: ReadonlySet<string>
  groupOf?: (agent: OfficeAgent) => GroupId
  snap?: boolean
}

export type OfficeEngine = {
  update: (input: OfficeInput) => void
  resize: (cssWidth: number, cssHeight: number, dpr: number) => void
  pick: (clientX: number, clientY: number) => PickTarget | null
  agentRect: (id: string) => RoomRect | null
  setHover: (id: HotspotId | null) => void
  setHoverAgent: (id: string | null) => void
  setReveal: (reveal: boolean) => void
  pulse: () => void
  destroy: () => void
}

const MAX_DELTA_SECONDS = 0.1

export function createOfficeEngine(canvas: HTMLCanvasElement): OfficeEngine {
  const context = getContext(canvas)
  const grid = createWalkGrid()
  const actors = createNpcActors()
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let input: OfficeInput | null = null
  let palette: OfficePalette | null = null
  let layers: RoomLayers | null = null
  let builtMode: OfficeInput['mode'] | null = null
  let view: ViewMetrics = computeView(canvas.clientWidth || 1, canvas.clientHeight || 1, window.devicePixelRatio || 1)
  let paletteDirty = true
  let frameHandle: number | null = null
  let lastTime: number | null = null
  let fontsReady = false
  let destroyed = false
  let hoveredId: HotspotId | null = null
  let hoveredAgentId: string | null = null
  let revealAll = false
  let pulsePending = false
  let pulseStart: number | null = null

  function shouldLoop(): boolean {
    return input !== null && !input.paused && !document.hidden && !reducedQuery.matches
  }

  function rebuildLayers(current: OfficeInput): void {
    palette = readPalette()
    loadBackdrop(current.world, markDirty)
    const backdrop = backdropLayer(current.world)
    layers = {
      room: backdrop ?? buildRoomLayer(palette),
      painted: backdrop !== null,
      shade: current.mode === 'night' ? buildShadeLayer(palette) : null,
    }
    builtMode = current.mode
    paletteDirty = false
  }

  function readSignals(current: OfficeInput): Signals {
    return {
      needsYou: countAgents([...current.agents]).needsYou,
      boardWaiting: current.boardWaiting,
      peakLoad: peakLoad(current.agents.map((agent) => agent.contextTokens), current.contextWindow),
      sourceReady: current.sourceReady,
      conflictCount: current.conflictIds?.size ?? 0,
    }
  }

  function startPulse(now: number): void {
    if (!pulsePending || !fontsReady) {
      return
    }
    pulsePending = false
    pulseStart = now
    setTimeout(requestFrame, PULSE_MS + 50)
  }

  function frame(now: number): void {
    frameHandle = null
    if (destroyed || !input) {
      return
    }
    if (paletteDirty || builtMode !== input.mode) {
      rebuildLayers(input)
    }
    if (!palette || !layers) {
      return
    }
    startPulse(now)
    const animate = !reducedQuery.matches
    const deltaSeconds = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, MAX_DELTA_SECONDS)
    lastTime = now
    updateActors(actors, deltaSeconds, reducedQuery.matches)
    renderFrame({
      context,
      view,
      palette,
      layers,
      actors: actors.values(),
      selectedId: input.selectedId,
      hoveredAgentId,
      ringedPartyKey: ringedPartyKey(actors.values(), hoveredAgentId, input.selectedId),
      seconds: now / 1000,
      animate,
      sourceReady: input.sourceReady,
      agentCount: input.agents.length,
      fontsReady,
      world: input.world,
      signals: readSignals(input),
      hotspots: { hoveredId, openId: input.openHotspot, revealAll, pulse: pulseAlpha(pulseStart, now, animate) },
    })
    if (shouldLoop()) {
      requestFrame()
      return
    }
    lastTime = null
  }

  function requestFrame(): void {
    if (frameHandle !== null || destroyed) {
      return
    }
    frameHandle = requestAnimationFrame(frame)
  }

  function markDirty(): void {
    paletteDirty = true
    requestFrame()
  }

  const themeObserver = new MutationObserver(markDirty)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-world'] })
  const handleVisibility = (): void => requestFrame()
  const handleMotionChange = (): void => {
    if (input) {
      syncActors(actors, input.sourceReady ? input.agents : [], grid, reducedQuery.matches || input.snap === true, input.contextWindow, input.groupOf)
    }
    requestFrame()
  }
  document.addEventListener('visibilitychange', handleVisibility)
  reducedQuery.addEventListener('change', handleMotionChange)
  void document.fonts.ready.then(() => {
    fontsReady = true
    requestFrame()
  })

  function update(next: OfficeInput): void {
    const themeChanged = !input || input.world !== next.world || input.mode !== next.mode
    input = next
    if (themeChanged) {
      paletteDirty = true
    }
    syncActors(actors, next.sourceReady ? next.agents : [], grid, reducedQuery.matches || next.snap === true, next.contextWindow, next.groupOf)
    markQuiet(actors, next.quiet)
    markParties(actors, next.partyByAgent)
    markConflicts(actors, next.conflictIds)
    requestFrame()
  }

  function resize(cssWidth: number, cssHeight: number, dpr: number): void {
    view = computeView(cssWidth, cssHeight, dpr)
    canvas.width = view.width
    canvas.height = view.height
    context.imageSmoothingEnabled = false
    requestFrame()
  }

  function actorAt(roomX: number, roomY: number): Actor | null {
    let found: Actor | null = null
    for (const actor of actors.values()) {
      const inside =
        actor.kind === 'agent' &&
        Math.abs(roomX - actor.x) <= AGENT_HALF_WIDTH &&
        roomY <= repoTagHitBottom(view, actor) &&
        roomY >= actor.y - AGENT_HEIGHT
      if (inside && (!found || actor.y > found.y)) {
        found = actor
      }
    }
    return found
  }

  function pick(clientX: number, clientY: number): PickTarget | null {
    const bounds = canvas.getBoundingClientRect()
    const point = toRoomPoint(view, (clientX - bounds.left) * view.dpr, (clientY - bounds.top) * view.dpr)
    return resolvePick(actorAt(point.x, point.y)?.id ?? null, point.x, point.y)
  }

  function agentRect(id: string): RoomRect | null {
    const actor = [...actors.values()].find((candidate) => candidate.kind === 'agent' && candidate.id === id)
    return actor ? agentHitRect(actor.x, actor.y) : null
  }

  function setHover(id: HotspotId | null): void {
    if (hoveredId === id) {
      return
    }
    hoveredId = id
    requestFrame()
  }

  function setHoverAgent(id: string | null): void {
    if (hoveredAgentId === id) {
      return
    }
    hoveredAgentId = id
    requestFrame()
  }

  function setReveal(reveal: boolean): void {
    if (revealAll === reveal) {
      return
    }
    revealAll = reveal
    requestFrame()
  }

  function pulse(): void {
    pulsePending = true
    requestFrame()
  }

  function destroy(): void {
    destroyed = true
    if (frameHandle !== null) {
      cancelAnimationFrame(frameHandle)
    }
    themeObserver.disconnect()
    document.removeEventListener('visibilitychange', handleVisibility)
    reducedQuery.removeEventListener('change', handleMotionChange)
  }

  return { update, resize, pick, agentRect, setHover, setHoverAgent, setReveal, pulse, destroy }
}
