import { goldOf, type Ledger, type TokenTotals } from '@shared/ledger'
import type { Loadable } from '@/lib/api'

export type LedgerState = Loadable<Ledger> & { date: string }

export type LedgerDay = 'today' | 'yesterday'

export const NO_PRICE_NOTE = 'มูลค่าเทียบราคา API ถ้าใช้แพ็กเกจรายเดือนจะไม่ได้ถูกเก็บเงินตามนี้'

export function ledgerQuery(dayOrDate: string): string {
  return dayOrDate === 'today' || dayOrDate === 'yesterday' ? `day=${dayOrDate}` : `date=${encodeURIComponent(dayOrDate)}`
}

export function formatGold(cost: number): string {
  return `◎ ${goldOf(cost).toLocaleString('en-US')}`
}

export function formatMoney(cost: number, currency: string | null): string {
  const amount = cost.toFixed(2)
  return currency ? `${amount} ${currency}` : amount
}

export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }
  if (count >= 1_000) {
    return `${Math.round(count / 1_000)}k`
  }
  return String(count)
}

export function unpricedNote(unpricedRows: number): string | null {
  return unpricedRows > 0 ? `มี ${unpricedRows} session ที่ไม่มีราคาใน pricing.json` : null
}

export function unpricedNoteOf(ledger: Ledger): string | null {
  return ledger.total === null ? null : unpricedNote(ledger.unpricedRows)
}

export function startLoading(previous: LedgerState, date: string): LedgerState {
  if (previous.date !== date) {
    return { data: null, error: null, loading: true, date }
  }
  return { ...previous, loading: true }
}

export function tokenBreakdown(tokens: TokenTotals): string {
  return [
    `input ${tokens.input.toLocaleString('en-US')}`,
    `output ${tokens.output.toLocaleString('en-US')}`,
    `cache อ่าน ${tokens.cacheRead.toLocaleString('en-US')}`,
    `cache เขียน 5 นาที ${tokens.cacheWrite5m.toLocaleString('en-US')}`,
    `cache เขียน 1 ชม. ${tokens.cacheWrite1h.toLocaleString('en-US')}`
  ].join('\n')
}


export function sessionCost(ledger: Ledger | null, agent: { id: string; session: string | null }): number | null {
  if (!ledger) {
    return null
  }
  const costs = ledger.rows.filter((row) => row.cost !== null && (row.agentId === agent.id || row.session === agent.session || row.session === agent.id))
  if (costs.length === 0) {
    return null
  }
  return costs.reduce((sum, row) => sum + (row.cost ?? 0), 0)
}
