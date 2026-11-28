import type { AgentState, OfficeAgent, SourceAgent } from '@shared/types'

export type StateSinceMemory = Map<string, { state: AgentState; since: number }>

export function stampStateSince(memory: StateSinceMemory, agents: SourceAgent[], now: number): OfficeAgent[] {
  const stamped = agents.map((agent) => ({ ...agent, stateSince: sinceFor(memory, agent, now) }))
  memory.clear()
  for (const agent of stamped) {
    memory.set(agent.id, { state: agent.state, since: agent.stateSince })
  }
  return stamped
}

function sinceFor(memory: StateSinceMemory, agent: SourceAgent, now: number): number {
  const previous = memory.get(agent.id)
  if (previous && previous.state === agent.state) {
    return previous.since
  }
  return now
}
