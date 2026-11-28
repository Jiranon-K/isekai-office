import type { AgentState, OfficeAgent, SourceAgent } from '@shared/types'

export type StateSinceMemory = Map<string, { state: AgentState; since: number }>

export async function readStateSince(memory: StateSinceMemory, read: () => Promise<SourceAgent[]>): Promise<OfficeAgent[]> {
  const agents = await read()
  return stampStateSince(memory, agents, Date.now())
}

export function stampStateSince(memory: StateSinceMemory, agents: SourceAgent[], now: number): OfficeAgent[] {
  const stamped = agents.map((agent) => ({ ...agent, stateSince: sinceFor(memory, agent, now) }))
  const presentIds = new Set(stamped.map((agent) => agent.id))
  for (const id of memory.keys()) {
    if (!presentIds.has(id)) {
      memory.delete(id)
    }
  }
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
