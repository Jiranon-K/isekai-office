import type { GuildLog, LogEvent, OfficeAgent, OfficeSnapshot } from '@shared/types'

const LOG_LIMIT = 100

export type LogState = { agents: OfficeAgent[] | null; events: LogEvent[] }

export const EMPTY_LOG_STATE: LogState = { agents: null, events: [] }

function changeOf(previous: OfficeAgent | undefined, current: OfficeAgent, at: number): LogEvent | null {
  if (previous?.state === current.state) {
    return null
  }
  return { at, agentId: current.id, title: current.title, from: previous?.state ?? null, to: current.state }
}

export function diffEvents(previous: OfficeAgent[], current: OfficeAgent[], at: number): LogEvent[] {
  const before = new Map(previous.map((agent) => [agent.id, agent]))
  const after = new Set(current.map((agent) => agent.id))
  const changes = current.map((agent) => changeOf(before.get(agent.id), agent, at))
  const left = previous
    .filter((agent) => !after.has(agent.id))
    .map((agent): LogEvent => ({ at, agentId: agent.id, title: agent.title, from: agent.state, to: null }))
  return [...changes.filter((event) => event !== null), ...left]
}

export function appendEvents(log: LogEvent[], events: LogEvent[], limit = LOG_LIMIT): LogEvent[] {
  const all = [...log, ...events]
  return all.slice(Math.max(0, all.length - limit))
}

export function recordSnapshot(state: LogState, snapshot: OfficeSnapshot): LogState {
  if (!snapshot.orcaRunning || snapshot.error) {
    return state
  }
  if (state.agents === null) {
    return { agents: snapshot.agents, events: state.events }
  }
  const events = diffEvents(state.agents, snapshot.agents, snapshot.at)
  return { agents: snapshot.agents, events: appendEvents(state.events, events) }
}

export function guildLog(events: LogEvent[]): GuildLog {
  return { events: [...events].reverse() }
}
