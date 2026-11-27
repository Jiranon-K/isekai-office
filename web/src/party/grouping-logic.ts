import type { OfficeAgent } from '@shared/types'
import type { Party } from './party-logic'

export const GROUPING_KEY = 'isekai-office-party-grouping'

const ON_VALUE = 'on'

export function parseGrouping(raw: string | null): boolean {
  return raw === ON_VALUE
}

export function serializeGrouping(grouped: boolean): string {
  return grouped ? ON_VALUE : 'off'
}

export function soloAgents(agents: readonly OfficeAgent[], found: readonly Party[]): OfficeAgent[] {
  const placed = new Set(found.flatMap((party) => party.members.map((member) => member.id)))
  return agents.filter((agent) => !placed.has(agent.id))
}
