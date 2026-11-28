import type { FileConflict } from '@shared/conflicts'
import type { OfficeAgent } from '@shared/types'

export type ConflictViewState = 'loading' | 'error' | 'empty' | 'list'

export function conflictRevisionKey(agents: readonly OfficeAgent[]): string {
  return agents
    .filter((agent) => agent.state !== 'done')
    .map((agent) => `${agent.id}:${agent.updatedAt}`)
    .sort()
    .join(',')
}

export function activeConflictAgentIds(
  conflicts: readonly FileConflict[],
  agents: readonly OfficeAgent[]
): Set<string> {
  const presentIds = new Set(agents.map((agent) => agent.id))
  const ids = new Set<string>()
  for (const conflict of conflicts) {
    for (const agentId of conflict.agentIds) {
      if (presentIds.has(agentId)) {
        ids.add(agentId)
      }
    }
  }
  return ids
}

export function conflictTabLabel(count: number): string {
  if (count > 0) {
    return `ไฟล์ชนกัน (${count})`
  }
  return 'ไฟล์ชนกัน'
}

export function resolveConflictAgents(
  conflict: FileConflict,
  agentsById: ReadonlyMap<string, OfficeAgent>
): OfficeAgent[] {
  const resolved: OfficeAgent[] = []
  for (const agentId of conflict.agentIds) {
    const agent = agentsById.get(agentId)
    if (agent) {
      resolved.push(agent)
    }
  }
  return resolved
}

export function classifyConflictView(
  conflicts: readonly FileConflict[],
  loading: boolean,
  error: string | null
): ConflictViewState {
  if (error !== null) {
    return 'error'
  }
  if (loading && conflicts.length === 0) {
    return 'loading'
  }
  if (conflicts.length === 0) {
    return 'empty'
  }
  return 'list'
}
