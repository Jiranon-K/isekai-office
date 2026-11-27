import type { ReplayAgent } from './replay-logic'

function sameAgent(left: ReplayAgent, right: ReplayAgent): boolean {
  return (
    left.agentId === right.agentId &&
    left.title === right.title &&
    left.repo === right.repo &&
    left.state === right.state &&
    left.station === right.station
  )
}

export function reuseAgents(previous: readonly ReplayAgent[], next: ReplayAgent[]): ReplayAgent[] {
  if (previous.length !== next.length) {
    return next
  }
  const unchanged = next.every((agent, index) => {
    const before = previous[index]
    return before !== undefined && sameAgent(before, agent)
  })
  return unchanged ? (previous as ReplayAgent[]) : next
}
