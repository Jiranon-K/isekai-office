import type { OfficeAgent } from '@shared/types'
import { waitingQueue } from '@/alerts/jump-logic'

export function longestWaiting(agents: readonly OfficeAgent[]): OfficeAgent | null {
  const waiting = waitingQueue(agents)
  const dated = waiting.filter((agent) => Number.isFinite(agent.stateSince))
  if (dated.length === 0) {
    return waiting[0] ?? null
  }
  return dated.reduce((oldest, agent) => (agent.stateSince < oldest.stateSince ? agent : oldest))
}
