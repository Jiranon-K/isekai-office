import type { GuildLog, OfficeSnapshot } from '@shared/types'
import { activeSource } from '../sources/select'
import { recordTick, recordWatch, restoreRing } from '../day-log/recorder'
import { appendEvents, EMPTY_LOG_STATE, guildLog, recordSnapshot } from './log'
import { readStateSince, type StateSinceMemory } from './state-since'

const POLL_MS = 2_000

type Listener = (snapshot: OfficeSnapshot) => void

const listeners = new Set<Listener>()
const DEFAULT_CONTEXT_WINDOW = 1_000_000

export function contextWindowFrom(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_CONTEXT_WINDOW
}

const DEFAULT_QUIET_MINUTES = 10
const MINUTE_MS = 60_000

export function quietAfterMsFrom(value: string | undefined): number {
  const parsed = Number(value)
  const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_QUIET_MINUTES
  return Math.floor(minutes * MINUTE_MS)
}

const contextWindow = contextWindowFrom(process.env.CONTEXT_WINDOW_TOKENS)
const quietAfterMs = quietAfterMsFrom(process.env.QUIET_AFTER_MINUTES)

const source = activeSource

let latest: OfficeSnapshot = { source: source.id, caps: source.caps, sourceReady: false, agents: [], contextWindow, quietAfterMs, error: null, at: 0 }
let logState = EMPTY_LOG_STATE
let polling = false
let lastPayload = ''
const stateSinceMemory: StateSinceMemory = new Map()

async function takeSnapshot(): Promise<OfficeSnapshot> {
  const managed = source.managedStats?.()
  const base = {
    source: source.id,
    caps: source.caps,
    contextWindow,
    quietAfterMs,
    ...(managed ? { managedCount: managed.count, managedCap: managed.cap } : {}),
    at: Date.now()
  }
  if (!(await source.ready())) {
    return { ...base, sourceReady: false, agents: [], error: null }
  }
  try {
    return { ...base, sourceReady: true, agents: await readStateSince(stateSinceMemory, () => source.listAgents()), error: null }
  } catch (error) {
    return { ...base, sourceReady: true, agents: latest.agents, error: error instanceof Error ? error.message : String(error) }
  }
}

async function tick(): Promise<void> {
  latest = await takeSnapshot()
  const previousAgents = logState.agents
  logState = recordSnapshot(logState, latest)
  void recordTick(previousAgents, latest)
  const payload = JSON.stringify({ ...latest, at: 0 })
  if (payload !== lastPayload) {
    lastPayload = payload
    for (const listener of listeners) {
      listener(latest)
    }
  }
  if (listeners.size > 0) {
    setTimeout(tick, POLL_MS)
    return
  }
  polling = false
  void recordWatch(false)
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  if (latest.at > 0) {
    listener(latest)
  }
  if (!polling) {
    polling = true
    void recordWatch(true)
    void tick()
  }
  return () => {
    listeners.delete(listener)
  }
}

export function currentSnapshot(): OfficeSnapshot {
  return latest
}

export function currentLog(): GuildLog {
  return guildLog(logState.events)
}

export async function restoreLog(): Promise<void> {
  const restored = await restoreRing()
  logState = { agents: logState.agents, events: appendEvents(restored, logState.events) }
}
