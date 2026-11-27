import type { OfficeAgent } from '@shared/types'

export function canReceive(agent: OfficeAgent): boolean {
  return agent.terminal !== null && agent.state === 'done'
}
