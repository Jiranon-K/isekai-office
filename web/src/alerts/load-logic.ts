import type { OfficeAgent } from '@shared/types'
import { canReceive } from '@/agent/receive-logic'
import { manaRatio } from '@/office/scene/mana'
import type { AlertText } from './alert-logic'

export const LOAD_ALERT_RATIO = 0.4
export const LOAD_REARM_RATIO = 0.3
export const COMPACT_TEXT = '/compact'

export type LoadStep = { armed: ReadonlySet<string>; fresh: OfficeAgent[] }

export function isOverLoad(agent: OfficeAgent, contextWindow: number): boolean {
  const ratio = manaRatio(agent.contextTokens, contextWindow)
  return ratio !== null && ratio >= LOAD_ALERT_RATIO
}

export function highLoadIds(agents: readonly OfficeAgent[], contextWindow: number): Set<string> {
  return new Set(agents.filter((agent) => isOverLoad(agent, contextWindow)).map((agent) => agent.id))
}

export function newlyHigh(armed: ReadonlySet<string>, agents: readonly OfficeAgent[], contextWindow: number): OfficeAgent[] {
  return agents.filter((agent) => isOverLoad(agent, contextWindow) && !armed.has(agent.id))
}

function isCool(agent: OfficeAgent, contextWindow: number): boolean {
  const ratio = manaRatio(agent.contextTokens, contextWindow)
  return ratio !== null && ratio < LOAD_REARM_RATIO
}

export function rearm(armed: ReadonlySet<string>, agents: readonly OfficeAgent[], contextWindow: number): Set<string> {
  const cool = new Set(agents.filter((agent) => isCool(agent, contextWindow)).map((agent) => agent.id))
  return new Set([...armed].filter((id) => !cool.has(id)))
}

export function advanceLoad(armed: ReadonlySet<string>, agents: readonly OfficeAgent[], contextWindow: number): LoadStep {
  const fresh = newlyHigh(armed, agents, contextWindow)
  const withFresh = new Set([...armed, ...fresh.map((agent) => agent.id)])
  return { armed: rearm(withFresh, agents, contextWindow), fresh }
}

export function loadAlertText(agent: OfficeAgent, contextWindow: number): AlertText {
  const percent = Math.round((manaRatio(agent.contextTokens, contextWindow) ?? 0) * 100)
  return { title: agent.title, body: `context ใช้ไป ${percent}% แล้ว` }
}

export function canSendCompact(agent: OfficeAgent): boolean {
  return canReceive(agent)
}
