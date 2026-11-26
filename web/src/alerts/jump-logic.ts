import type { OfficeAgent } from '@shared/types'
import { needsDecision } from '@/agent/panel-logic'

export type JumpKeyEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing'>

const JUMP_KEY = 'n'

function compareWait(first: OfficeAgent, second: OfficeAgent): number {
  if (first.updatedAt !== second.updatedAt) {
    return first.updatedAt - second.updatedAt
  }
  return first.id < second.id ? -1 : first.id > second.id ? 1 : 0
}

export function waitingQueue(agents: readonly OfficeAgent[]): OfficeAgent[] {
  return agents.filter((agent) => needsDecision(agent.state)).sort(compareWait)
}

export function nextWaiting(agents: readonly OfficeAgent[], currentId: string | null): string | null {
  const queue = waitingQueue(agents)
  const index = queue.findIndex((agent) => agent.id === currentId)
  return queue[(index + 1) % queue.length]?.id ?? null
}

export function isJumpKey(event: JumpKeyEvent, typing: boolean, boardOpen: boolean): boolean {
  if (event.key !== JUMP_KEY || typing || boardOpen) {
    return false
  }
  return !(event.ctrlKey || event.metaKey || event.altKey || event.isComposing)
}
