import type { OfficeAgent } from '@shared/types'
import type { AlertText } from './alert-logic'

const MINUTE_MS = 60_000

export function isQuiet(agent: OfficeAgent, now: number, quietAfterMs: number): boolean {
  return agent.state === 'working' && now - agent.activeAt >= quietAfterMs
}

export function quietMinutes(agent: OfficeAgent, now: number): number {
  return Math.max(0, Math.floor((now - agent.activeAt) / MINUTE_MS))
}

export function quietMinutesById(agents: readonly OfficeAgent[], now: number, quietAfterMs: number): Map<string, number> {
  const quiet = agents.filter((agent) => isQuiet(agent, now, quietAfterMs))
  return new Map(quiet.map((agent) => [agent.id, quietMinutes(agent, now)]))
}

export function newlyQuiet(previousIds: ReadonlySet<string>, agents: readonly OfficeAgent[], now: number, quietAfterMs: number): OfficeAgent[] {
  return agents.filter((agent) => isQuiet(agent, now, quietAfterMs) && !previousIds.has(agent.id))
}

export function quietAlertText(agent: OfficeAgent, now: number): AlertText {
  return { title: agent.title, body: `เงียบไป ${quietMinutes(agent, now)} นาทีแล้ว` }
}

export function clockRuns(alertsEnabled: boolean, visibility: string): boolean {
  return alertsEnabled || visibility !== 'hidden'
}
