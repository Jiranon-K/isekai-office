import { describe, expect, test } from 'bun:test'
import type { Ledger, LedgerRow } from '@shared/ledger'
import { dateOfDay, formatGold, formatMoney, formatTokenCount, sessionCost, tokenBreakdown, unpricedNote } from './ledger-logic'

const TOKENS = { input: 1, output: 2, cacheRead: 3, cacheWrite5m: 4, cacheWrite1h: 5 }

function row(session: string, cost: number | null): LedgerRow {
  return { session, agentId: null, title: 't', repo: null, model: 'm', tokens: TOKENS, cost }
}

function ledgerOf(rows: LedgerRow[]): Ledger {
  return { date: '2026-05-10', currency: 'USD', rows, total: null, unpricedRows: 0, at: 0 }
}

describe('ledger formatting', () => {
  test('one gold is a hundredth of the currency', () => {
    expect(formatGold(12.4)).toBe('◎ 1,240')
    expect(formatGold(0)).toBe('◎ 0')
  })

  test('the money line shows two decimals and the currency', () => {
    expect(formatMoney(12.4, 'USD')).toBe('12.40 USD')
    expect(formatMoney(0.5, null)).toBe('0.50')
  })

  test('token counts shorten to k and M', () => {
    expect(formatTokenCount(999)).toBe('999')
    expect(formatTokenCount(12_400)).toBe('12k')
    expect(formatTokenCount(3_450_000)).toBe('3.5M')
  })

  test('the unpriced note appears only when something is unpriced', () => {
    expect(unpricedNote(0)).toBeNull()
    expect(unpricedNote(2)).toBe('มี 2 session ที่ไม่มีราคาใน pricing.json')
  })

  test('the hover lists all five counts', () => {
    expect(tokenBreakdown(TOKENS).split('\n')).toHaveLength(5)
  })
})

describe('days', () => {
  test('yesterday is one calendar day before today', () => {
    const now = new Date(2026, 4, 10, 12).getTime()
    expect(dateOfDay('today', now)).toBe('2026-05-10')
    expect(dateOfDay('yesterday', now)).toBe('2026-05-09')
  })
})

describe('sessionCost', () => {
  test('rows of one session add up and unpriced rows are skipped', () => {
    const ledger = ledgerOf([row('a', 1.5), row('a', 2), row('a', null), row('b', 9)])
    expect(sessionCost(ledger, { id: 'a', session: null })).toBe(3.5)
  })

  test('an agent is matched by session id as well', () => {
    expect(sessionCost(ledgerOf([row('file-1', 4)]), { id: 'agent-1', session: 'file-1' })).toBe(4)
  })

  test('no ledger, an unknown session or no priced row gives null', () => {
    expect(sessionCost(null, { id: 'a', session: null })).toBeNull()
    expect(sessionCost(ledgerOf([row('a', null)]), { id: 'a', session: null })).toBeNull()
    expect(sessionCost(ledgerOf([row('a', 1)]), { id: 'z', session: null })).toBeNull()
  })
})
