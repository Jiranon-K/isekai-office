import type { DayEvent } from '@shared/day-log'
import type { StationId } from '@shared/stations'
import type { AgentState, OfficeAgent } from '@shared/types'
import { groupForAgent, type GroupId } from '@/office/scene/stations'

export type ReplayAgent = {
  agentId: string
  title: string
  repo: string | null
  state: AgentState
  station: StationId | null
}

export type Span = { from: number; to: number }

export type Lane = { agentId: string; title: string; waits: Span[]; present: Span[] }

export type ReplayDay = { date: string; start: number; end: number; watched: Span[]; lanes: Lane[] }

type StateEvent = Extract<DayEvent, { kind: 'state' }>
type StationEvent = Extract<DayEvent, { kind: 'station' }>

export const MAX_LANES = 10

function firstIndexAfter(events: readonly DayEvent[], at: number): number {
  let low = 0
  let high = events.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if ((events[middle]?.at ?? 0) <= at) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

function firstIndexFrom(events: readonly DayEvent[], at: number): number {
  let low = 0
  let high = events.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if ((events[middle]?.at ?? 0) < at) {
      low = middle + 1
    } else {
      high = middle
    }
  }
  return low
}

function applyState(present: Map<string, ReplayAgent>, event: StateEvent): void {
  if (event.to === null) {
    present.delete(event.agentId)
    return
  }
  const previous = present.get(event.agentId)
  present.set(event.agentId, {
    agentId: event.agentId,
    title: event.title,
    repo: event.repo,
    state: event.to,
    station: event.to === 'working' ? (previous?.station ?? null) : null
  })
}

function applyStation(present: Map<string, ReplayAgent>, event: StationEvent): void {
  const agent = present.get(event.agentId)
  if (agent) {
    present.set(event.agentId, { ...agent, station: event.station })
  }
}

export function agentsAt(events: readonly DayEvent[], at: number): ReplayAgent[] {
  const present = new Map<string, ReplayAgent>()
  const count = firstIndexAfter(events, at)
  for (let index = 0; index < count; index += 1) {
    const event = events[index]
    if (event?.kind === 'state') {
      applyState(present, event)
    }
    if (event?.kind === 'station') {
      applyStation(present, event)
    }
  }
  return [...present.values()]
}

function wholeDay(events: readonly DayEvent[]): Span[] {
  const first = events[0]
  const last = events[events.length - 1]
  if (!first || !last || last.at <= first.at) {
    return []
  }
  return [{ from: first.at, to: last.at }]
}

type WatchEvent = Extract<DayEvent, { kind: 'watch' }>

function applyWatch(spans: Span[], openAt: number | null, lastSeen: number, event: WatchEvent, dayStart: number): number | null {
  if (event.on) {
    if (openAt !== null) {
      spans.push({ from: openAt, to: lastSeen })
    }
    return event.at
  }
  if (openAt !== null) {
    spans.push({ from: openAt, to: event.at })
  } else if (spans.length === 0) {
    spans.push({ from: dayStart, to: event.at })
  }
  return null
}

export function watchedSpans(events: readonly DayEvent[]): Span[] {
  if (!events.some((event) => event.kind === 'watch')) {
    return wholeDay(events)
  }
  const spans: Span[] = []
  const dayStart = events[0]?.at ?? 0
  let openAt: number | null = null
  let lastSeen = 0
  for (const event of events) {
    if (event.kind === 'watch') {
      openAt = applyWatch(spans, openAt, lastSeen, event, dayStart)
    }
    lastSeen = event.at
  }
  if (openAt !== null) {
    spans.push({ from: openAt, to: lastSeen })
  }
  return spans.filter((span) => span.to > span.from)
}

export function isWatched(spans: readonly Span[], at: number): boolean {
  return spans.some((span) => at >= span.from && at <= span.to)
}

export function nextWatchedAt(spans: readonly Span[], at: number): number | null {
  const upcoming = spans.find((span) => span.from > at)
  return upcoming ? upcoming.from : null
}

type LaneBuilder = { lane: Lane; presentFrom: number | null; waitFrom: number | null }

function pushSpan(spans: Span[], from: number | null, to: number): void {
  if (from !== null && to > from) {
    spans.push({ from, to })
  }
}

function isWaiting(state: AgentState | null): boolean {
  return state === 'waiting' || state === 'blocked'
}

function applyToLane(builder: LaneBuilder, event: StateEvent): void {
  builder.lane.title = event.title
  if (event.to === null) {
    pushSpan(builder.lane.present, builder.presentFrom, event.at)
    builder.presentFrom = null
  } else if (builder.presentFrom === null) {
    builder.presentFrom = event.at
  }
  if (isWaiting(event.to) && builder.waitFrom === null) {
    builder.waitFrom = event.at
  }
  if (!isWaiting(event.to) && builder.waitFrom !== null) {
    pushSpan(builder.lane.waits, builder.waitFrom, event.at)
    builder.waitFrom = null
  }
}

function clipToWatched(spans: readonly Span[], watched: readonly Span[]): Span[] {
  return spans.flatMap((span) =>
    watched
      .map((window) => ({ from: Math.max(span.from, window.from), to: Math.min(span.to, window.to) }))
      .filter((piece) => piece.to > piece.from)
  )
}

export function lanes(events: readonly DayEvent[]): Lane[] {
  const builders = new Map<string, LaneBuilder>()
  for (const event of events) {
    if (event.kind !== 'state') {
      continue
    }
    const builder = builders.get(event.agentId) ?? {
      lane: { agentId: event.agentId, title: event.title, waits: [], present: [] },
      presentFrom: null,
      waitFrom: null
    }
    builders.set(event.agentId, builder)
    applyToLane(builder, event)
  }
  const end = events[events.length - 1]?.at ?? 0
  const watched = watchedSpans(events)
  return [...builders.values()].map((builder) => {
    pushSpan(builder.lane.present, builder.presentFrom, end)
    pushSpan(builder.lane.waits, builder.waitFrom, end)
    const { lane } = builder
    return { ...lane, present: clipToWatched(lane.present, watched), waits: clipToWatched(lane.waits, watched) }
  })
}

export function buildReplayDay(date: string, events: readonly DayEvent[]): ReplayDay {
  return {
    date,
    start: events[0]?.at ?? 0,
    end: events[events.length - 1]?.at ?? 0,
    watched: watchedSpans(events),
    lanes: lanes(events)
  }
}

export function nextEventAt(events: readonly DayEvent[], at: number): number | null {
  return events[firstIndexAfter(events, at)]?.at ?? null
}

export function previousEventAt(events: readonly DayEvent[], at: number): number | null {
  return events[firstIndexFrom(events, at) - 1]?.at ?? null
}

export function limitLanes(all: readonly Lane[], max: number = MAX_LANES): { shown: Lane[]; hidden: number } {
  return { shown: all.slice(0, max), hidden: Math.max(0, all.length - max) }
}

export function toOfficeAgent(agent: ReplayAgent): OfficeAgent {
  return {
    id: agent.agentId,
    title: agent.title,
    repo: agent.repo,
    workspace: null,
    worktree: null,
    session: null,
    contextTokens: null,
    state: agent.state,
    tool: null,
    lastMessage: null,
    updatedAt: 0,
    activeAt: 0,
    terminal: null
  }
}

export function groupOfReplay(agents: readonly ReplayAgent[]): (agent: OfficeAgent) => GroupId {
  const stations = new Map(agents.map((agent) => [agent.agentId, agent.station]))
  return (agent) => {
    if (agent.state !== 'working') {
      return groupForAgent(agent)
    }
    return stations.get(agent.id) ?? 'forge'
  }
}
