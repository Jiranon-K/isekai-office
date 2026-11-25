import type { OfficeAgent } from '@shared/types'

export type AgentCounts = { total: number; working: number; needsYou: number }

export function countAgents(agents: OfficeAgent[]): AgentCounts {
  return {
    total: agents.length,
    working: agents.filter((agent) => agent.state === 'working').length,
    needsYou: agents.filter((agent) => agent.state === 'waiting' || agent.state === 'blocked').length
  }
}
