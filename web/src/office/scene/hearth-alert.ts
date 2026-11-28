import type { AgentState } from '@shared/types'
import { needsDecision } from '@/agent/panel-logic'

export const WAIT_ALERT_MS = 120_000

export type HearthTone = 'dim' | 'amber' | 'red'

export type HearthSubject = { kind: 'agent' | 'npc'; state: AgentState | null; stateSince: number | null }

function waitedTooLong(subject: HearthSubject, now: number): boolean {
  if (subject.kind !== 'agent' || subject.state === null || !needsDecision(subject.state)) {
    return false
  }
  if (subject.stateSince === null || !Number.isFinite(subject.stateSince)) {
    return false
  }
  return now - subject.stateSince > WAIT_ALERT_MS
}

export function hearthTone(subjects: readonly HearthSubject[], now: number, sourceReady: boolean): HearthTone {
  const agents = subjects.filter((subject) => subject.kind === 'agent')
  if (!sourceReady || agents.length === 0) {
    return 'dim'
  }
  return agents.some((agent) => waitedTooLong(agent, now)) ? 'red' : 'amber'
}
