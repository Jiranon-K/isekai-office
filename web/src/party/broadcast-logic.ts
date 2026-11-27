import type { OfficeAgent } from '@shared/types'
import { skipReasonOf, type BroadcastRow } from './party-logic'

export type BroadcastDeps = {
  latest(agentId: string): OfficeAgent | null
  send(agentId: string, text: string): Promise<string | null>
  report(rows: BroadcastRow[]): void
  isCancelled(): boolean
}

export const GONE_REASON = 'ไม่อยู่ในห้องแล้ว'
export const UNREACHABLE_REASON = 'server_unreachable'

export type SubmitGuard = { current: boolean }

export function claimSubmit(guard: SubmitGuard): boolean {
  if (guard.current) {
    return false
  }
  guard.current = true
  return true
}

export function releaseSubmit(guard: SubmitGuard): void {
  guard.current = false
}

export function initialRows(agentIds: readonly string[]): BroadcastRow[] {
  return agentIds.map((agentId) => ({ agentId, status: 'idle', reason: null }))
}

export function textAfterRun(text: string, rows: readonly BroadcastRow[]): string {
  return rows.length > 0 && rows.every((row) => row.status === 'sent') ? '' : text
}

export function describeRow(row: BroadcastRow): string | null {
  if (row.status === 'sending') {
    return 'กำลังส่ง'
  }
  if (row.status === 'sent') {
    return 'ส่งแล้ว'
  }
  if (row.status === 'failed') {
    return `ส่งไม่สำเร็จ (${row.reason})`
  }
  return row.status === 'skipped' ? row.reason : null
}

function withRow(rows: BroadcastRow[], next: BroadcastRow): BroadcastRow[] {
  return rows.map((row) => (row.agentId === next.agentId ? next : row))
}

async function sendOne(agentId: string, text: string, deps: BroadcastDeps): Promise<BroadcastRow> {
  const agent = deps.latest(agentId)
  if (!agent) {
    return { agentId, status: 'skipped', reason: GONE_REASON }
  }
  const skipped = skipReasonOf(agent)
  if (skipped) {
    return { agentId, status: 'skipped', reason: skipped }
  }
  try {
    const failure = await deps.send(agentId, text)
    return failure ? { agentId, status: 'failed', reason: failure } : { agentId, status: 'sent', reason: null }
  } catch {
    return { agentId, status: 'failed', reason: UNREACHABLE_REASON }
  }
}

export async function runBroadcast(agentIds: readonly string[], text: string, deps: BroadcastDeps): Promise<BroadcastRow[]> {
  let rows = initialRows(agentIds)
  if (deps.isCancelled()) {
    return rows
  }
  deps.report(rows)
  for (const agentId of agentIds) {
    if (deps.isCancelled()) {
      return rows
    }
    rows = withRow(rows, { agentId, status: 'sending', reason: null })
    deps.report(rows)
    rows = withRow(rows, await sendOne(agentId, text, deps))
    if (deps.isCancelled()) {
      return rows
    }
    deps.report(rows)
  }
  return rows
}
