import type { DayEvent, DayLog } from '@shared/day-log'
import type { Ledger } from '@shared/ledger'
import { watchedSpans, type Span } from '@/replay/replay-logic'
import { clipSpan, clipToWatched, isWaitState, spanLength, stateSpans, totalLength, type StateSpan } from './summary-spans'

export type AgentDay = {
  agentId: string
  title: string
  repo: string | null
  workingMs: number
  waitingMs: number
  waits: number
  longestWaitMs: number
  finished: boolean
}

export type DaySummary = {
  date: string
  watchedMs: number
  sessions: number
  finished: number
  waitingMs: number
  waits: number
  medianWaitMs: number | null
  longestWait: { title: string; ms: number; at: number } | null
  busiestHour: number | null
  agents: AgentDay[]
  spend: { amount: number; currency: string } | null
}

type Wait = { agentId: string; title: string; ms: number; at: number }

function mergeWaitRuns(spans: readonly StateSpan[]): StateSpan[] {
  const runs: StateSpan[] = []
  for (const span of spans) {
    if (!isWaitState(span.state)) {
      continue
    }
    const previous = runs.findLast((run) => run.agentId === span.agentId)
    if (previous && previous.to === span.from) {
      previous.to = span.to
      continue
    }
    runs.push({ ...span })
  }
  return runs
}

export function waitsOf(spans: readonly StateSpan[], watched: readonly Span[]): Wait[] {
  const waits: Wait[] = []
  for (const run of mergeWaitRuns(spans)) {
    const pieces = clipSpan(run, watched)
    const first = pieces[0]
    if (first) {
      waits.push({ agentId: run.agentId, title: run.title, ms: totalLength(pieces), at: first.from })
    }
  }
  return waits
}

export function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null
  }
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

function addToHours(hours: Map<number, number>, span: Span): void {
  let cursor = span.from
  while (cursor < span.to) {
    const moment = new Date(cursor)
    const nextHour = new Date(moment.getFullYear(), moment.getMonth(), moment.getDate(), moment.getHours() + 1).getTime()
    const end = Math.min(span.to, nextHour)
    hours.set(moment.getHours(), (hours.get(moment.getHours()) ?? 0) + (end - cursor))
    cursor = end
  }
}

export function busiestHourOf(workingSpans: readonly Span[]): number | null {
  const hours = new Map<number, number>()
  for (const span of workingSpans) {
    addToHours(hours, span)
  }
  let best: number | null = null
  for (const [hour, ms] of hours) {
    if (best === null || ms > (hours.get(best) ?? 0) || (ms === hours.get(best) && hour < best)) {
      best = hour
    }
  }
  return best
}

function finishedAgents(events: readonly DayEvent[]): Set<string> {
  const last = new Map<string, boolean>()
  for (const event of events) {
    if (event.kind === 'state' && event.to !== null) {
      last.set(event.agentId, event.to === 'done')
    }
  }
  return new Set([...last].filter(([, done]) => done).map(([agentId]) => agentId))
}

type Identity = { title: string; repo: string | null }

function identitiesOf(events: readonly DayEvent[]): Map<string, Identity> {
  const identities = new Map<string, Identity>()
  for (const event of events) {
    if (event.kind === 'state') {
      identities.set(event.agentId, { title: event.title, repo: event.repo })
    }
  }
  return identities
}

function agentDay(spans: readonly StateSpan[], waits: readonly Wait[], finished: ReadonlySet<string>, agentId: string, identity: Identity): AgentDay {
  const own = spans.filter((span) => span.agentId === agentId)
  const ownWaits = waits.filter((wait) => wait.agentId === agentId)
  return {
    agentId,
    title: identity.title,
    repo: identity.repo,
    workingMs: totalLength(own.filter((span) => span.state === 'working')),
    waitingMs: ownWaits.reduce((sum, wait) => sum + wait.ms, 0),
    waits: ownWaits.length,
    longestWaitMs: Math.max(0, ...ownWaits.map((wait) => wait.ms)),
    finished: finished.has(agentId)
  }
}

function spendOf(ledger: Ledger | null): DaySummary['spend'] {
  if (!ledger || ledger.total === null) {
    return null
  }
  return { amount: ledger.total, currency: ledger.currency ?? '' }
}

function longestOf(waits: readonly Wait[]): DaySummary['longestWait'] {
  const longest = waits.reduce<Wait | null>((best, wait) => (best === null || wait.ms > best.ms ? wait : best), null)
  return longest ? { title: longest.title, ms: longest.ms, at: longest.at } : null
}

export function summarise(day: DayLog, ledger: Ledger | null): DaySummary {
  const watched = watchedSpans(day.events)
  const raw = stateSpans(day.events)
  const clipped = clipToWatched(raw, watched)
  const waits = waitsOf(raw, watched)
  const finished = finishedAgents(day.events)
  const identities = identitiesOf(day.events)
  const agents = [...identities]
    .map(([agentId, identity]) => agentDay(clipped, waits, finished, agentId, identity))
    .sort((first, second) => second.waitingMs - first.waitingMs)
  return {
    date: day.date,
    watchedMs: watched.reduce((sum, span) => sum + spanLength(span), 0),
    sessions: agents.length,
    finished: agents.filter((agent) => agent.finished).length,
    waitingMs: waits.reduce((sum, wait) => sum + wait.ms, 0),
    waits: waits.length,
    medianWaitMs: medianOf(waits.map((wait) => wait.ms)),
    longestWait: longestOf(waits),
    busiestHour: busiestHourOf(clipped.filter((span) => span.state === 'working')),
    agents,
    spend: spendOf(ledger)
  }
}
