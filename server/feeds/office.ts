import type { OfficeSnapshot } from '@shared/types'
import { listAgents, orcaRunning } from '../sources/orca'

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

let latest: OfficeSnapshot = { orcaRunning: false, agents: [], contextWindow, quietAfterMs, error: null, at: 0 }
let polling = false
let lastPayload = ''

async function takeSnapshot(): Promise<OfficeSnapshot> {
  if (!(await orcaRunning())) {
    return { orcaRunning: false, agents: [], contextWindow, quietAfterMs, error: null, at: Date.now() }
  }
  try {
    return { orcaRunning: true, agents: await listAgents(), contextWindow, quietAfterMs, error: null, at: Date.now() }
  } catch (error) {
    return { orcaRunning: true, agents: latest.agents, contextWindow, quietAfterMs, error: error instanceof Error ? error.message : String(error), at: Date.now() }
  }
}

async function tick(): Promise<void> {
  latest = await takeSnapshot()
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
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  if (latest.at > 0) {
    listener(latest)
  }
  if (!polling) {
    polling = true
    void tick()
  }
  return () => {
    listeners.delete(listener)
  }
}

export function currentSnapshot(): OfficeSnapshot {
  return latest
}
