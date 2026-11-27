import type { Choice, OfficeAgent } from '@shared/types'
import { waitingQueue } from '@/alerts/jump-logic'
import { choiceForKey } from './choice-logic'
import { needsDecision } from './panel-logic'

export const ACT_DELAY_MS = 400

const OPEN_KEY = 'a'

export type QueueState = { skipped: ReadonlySet<string>; currentId: string | null; shownAt: number }

export type QueueKey =
  | { kind: 'choose'; choice: number }
  | { kind: 'deny' }
  | { kind: 'skip' }
  | { kind: 'expand' }
  | { kind: 'close' }

export type QueueKeyEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing'>

const LETTER_KEYS: Record<string, QueueKey> = {
  x: { kind: 'deny' },
  s: { kind: 'skip' },
  o: { kind: 'expand' }
}

export function queueOrder(agents: readonly OfficeAgent[], skipped: ReadonlySet<string>): OfficeAgent[] {
  return waitingQueue(agents).filter((agent) => !skipped.has(agent.id))
}

export function currentOf(state: QueueState, agents: readonly OfficeAgent[]): OfficeAgent | null {
  const sticky = agents.find((agent) => agent.id === state.currentId && needsDecision(agent.state))
  return sticky ?? queueOrder(agents, state.skipped)[0] ?? null
}

export function nextOf(state: QueueState, agents: readonly OfficeAgent[]): OfficeAgent | null {
  const current = currentOf(state, agents)
  return queueOrder(agents, state.skipped).find((agent) => agent.id !== current?.id) ?? null
}

export function forgetGone(skipped: ReadonlySet<string>, agents: readonly OfficeAgent[]): ReadonlySet<string> {
  const waiting = new Set(waitingQueue(agents).map((agent) => agent.id))
  const kept = [...skipped].filter((id) => waiting.has(id))
  return kept.length === skipped.size ? skipped : new Set(kept)
}

export function startQueue(agents: readonly OfficeAgent[], now: number): QueueState {
  return { skipped: new Set(), currentId: waitingQueue(agents)[0]?.id ?? null, shownAt: now }
}

function restartRound(agents: readonly OfficeAgent[], handledId: string | null, now: number): QueueState {
  const waiting = waitingQueue(agents)
  const first = waiting.find((agent) => agent.id !== handledId) ?? waiting[0]
  return { skipped: new Set(), currentId: first?.id ?? null, shownAt: now }
}

function withCurrent(state: QueueState, skipped: ReadonlySet<string>, currentId: string | null, now: number): QueueState {
  if (currentId === state.currentId) {
    return skipped === state.skipped ? state : { ...state, skipped }
  }
  return { skipped, currentId, shownAt: now }
}

export function settle(state: QueueState, agents: readonly OfficeAgent[], now: number): QueueState {
  const skipped = forgetGone(state.skipped, agents)
  const current = currentOf({ ...state, skipped }, agents)
  if (current !== null) {
    return withCurrent(state, skipped, current.id, now)
  }
  if (waitingQueue(agents).length > 0) {
    return restartRound(agents, null, now)
  }
  return withCurrent(state, skipped, null, now)
}

function moveOn(state: QueueState, agents: readonly OfficeAgent[], now: number): QueueState {
  const handledId = state.currentId
  if (handledId === null) {
    return settle(state, agents, now)
  }
  const skipped = new Set([...forgetGone(state.skipped, agents), handledId])
  const next = queueOrder(agents, skipped)[0]
  if (next === undefined) {
    return restartRound(agents, handledId, now)
  }
  return { skipped, currentId: next.id, shownAt: now }
}

export function afterAnswer(state: QueueState, agents: readonly OfficeAgent[], now: number): QueueState {
  return moveOn(state, agents, now)
}

export function afterSkip(state: QueueState, agents: readonly OfficeAgent[], now: number): QueueState {
  return moveOn(state, agents, now)
}

export function keyFor(event: QueueKeyEvent, choices: readonly Choice[]): QueueKey | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
    return null
  }
  if (event.key === 'Escape') {
    return { kind: 'close' }
  }
  const letter = LETTER_KEYS[event.key.toLowerCase()]
  if (letter) {
    return letter
  }
  if (choices.length === 0) {
    return event.key === '1' ? { kind: 'choose', choice: 1 } : null
  }
  const choice = choiceForKey(event.key, [...choices])
  return choice === null ? null : { kind: 'choose', choice }
}

export function canAct(state: QueueState, now: number, screenLoaded: boolean): boolean {
  if (!screenLoaded || state.currentId === null) {
    return false
  }
  return now - state.shownAt >= ACT_DELAY_MS
}

export function loadedScreen<Screen>(screen: Screen | null, loadedFor: number | null, updatedAt: number): Screen | null {
  return screen !== null && loadedFor === updatedAt ? screen : null
}

export function prefetchedScreen<Screen>(prefetched: { agentId: string; updatedAt: number; detail: Screen } | null, agentId: string, updatedAt: number): Screen | null {
  if (prefetched === null || prefetched.agentId !== agentId) {
    return null
  }
  return loadedScreen(prefetched.detail, prefetched.updatedAt, updatedAt)
}

export function answerLockHeld(answeredFor: number | null, updatedAt: number, screenLoaded: boolean): boolean {
  if (answeredFor === null) {
    return false
  }
  return answeredFor === updatedAt || !screenLoaded
}

export function restartGuard(state: QueueState, arrivedAt: number): QueueState {
  return arrivedAt > state.shownAt ? { ...state, shownAt: arrivedAt } : state
}

export function isQueueOpenKey(event: QueueKeyEvent, typing: boolean, boardOpen: boolean): boolean {
  if (event.key !== OPEN_KEY || typing || boardOpen) {
    return false
  }
  return !(event.ctrlKey || event.metaKey || event.altKey || event.isComposing)
}
