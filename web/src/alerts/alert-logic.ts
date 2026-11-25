import type { OfficeAgent } from '@shared/types'
import { needsDecision } from '@/agent/panel-logic'

export const APP_TITLE = 'Isekai Office'
export const ALERTS_KEY = 'isekai-office-alerts'
const BODY_LIMIT = 120
const WAITING_BODY = 'รอคุณตัดสินใจ'
const BLOCKED_BODY = 'ติดอยู่ ต้องการคุณ'

export type AlertText = { title: string; body: string }

export type ReplyMode = 'quick' | 'full'

export function newlyWaiting(previous: readonly OfficeAgent[] | null, current: readonly OfficeAgent[]): OfficeAgent[] {
  if (previous === null) {
    return []
  }
  const waitingBefore = new Set(previous.filter((agent) => needsDecision(agent.state)).map((agent) => agent.id))
  return current.filter((agent) => needsDecision(agent.state) && !waitingBefore.has(agent.id))
}

function firstLine(message: string | null): string | null {
  const line = (message ?? '')
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part !== '')
  return line ?? null
}

export function alertText(agent: OfficeAgent): AlertText {
  const fallback = agent.state === 'blocked' ? BLOCKED_BODY : WAITING_BODY
  const body = (firstLine(agent.lastMessage) ?? fallback).slice(0, BODY_LIMIT)
  return { title: agent.title, body }
}

export function tabTitle(count: number): string {
  return count > 0 ? `(${count}) ${APP_TITLE}` : APP_TITLE
}

export function canAlert(enabled: boolean, permission: string, visibility: string): boolean {
  return enabled && permission === 'granted' && visibility === 'hidden'
}

export function storedEnabled(stored: string | null, permission: string): boolean {
  return stored === '1' && permission === 'granted'
}

export function replyMode(agent: OfficeAgent, expanded: boolean): ReplyMode {
  return needsDecision(agent.state) && !expanded ? 'quick' : 'full'
}
