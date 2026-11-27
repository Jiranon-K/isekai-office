import type { DayEvent } from '@shared/day-log'
import type { AgentState } from '@shared/types'
import type { Span } from '@/replay/replay-logic'

export type StateSpan = {
  agentId: string
  title: string
  repo: string | null
  state: AgentState
  from: number
  to: number
}

type OpenSpan = { title: string; repo: string | null; state: AgentState; from: number }

export function isWaitState(state: AgentState): boolean {
  return state === 'waiting' || state === 'blocked'
}

function closeSpan(spans: StateSpan[], agentId: string, open: OpenSpan | undefined, at: number): void {
  if (!open || at <= open.from) {
    return
  }
  spans.push({ agentId, title: open.title, repo: open.repo, state: open.state, from: open.from, to: at })
}

export function stateSpans(events: readonly DayEvent[]): StateSpan[] {
  const spans: StateSpan[] = []
  const open = new Map<string, OpenSpan>()
  for (const event of events) {
    if (event.kind !== 'state') {
      continue
    }
    closeSpan(spans, event.agentId, open.get(event.agentId), event.at)
    open.delete(event.agentId)
    if (event.to !== null) {
      open.set(event.agentId, { title: event.title, repo: event.repo, state: event.to, from: event.at })
    }
  }
  const end = events[events.length - 1]?.at ?? 0
  for (const [agentId, remaining] of open) {
    closeSpan(spans, agentId, remaining, end)
  }
  return spans.sort((first, second) => first.from - second.from)
}

export function clipSpan(span: Span, watched: readonly Span[]): Span[] {
  const pieces: Span[] = []
  for (const window of watched) {
    const from = Math.max(span.from, window.from)
    const to = Math.min(span.to, window.to)
    if (to > from) {
      pieces.push({ from, to })
    }
  }
  return pieces
}

export function clipToWatched(spans: readonly StateSpan[], watched: readonly Span[]): StateSpan[] {
  return spans.flatMap((span) => clipSpan(span, watched).map((piece) => ({ ...span, from: piece.from, to: piece.to })))
}

export function spanLength(span: Span): number {
  return span.to - span.from
}

export function totalLength(spans: readonly Span[]): number {
  return spans.reduce((sum, span) => sum + spanLength(span), 0)
}
