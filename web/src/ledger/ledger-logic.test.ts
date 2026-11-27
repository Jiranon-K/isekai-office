import { describe, expect, test } from 'bun:test'
import type { Ledger, LedgerRow } from '@shared/ledger'
import { formatGold, formatMoney, ledgerQuery, formatTokenCount, sessionCost, tokenBreakdown, unpricedNote, unpricedNoteOf, startLoading } from './ledger-logic'

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

  test('with no price at all only the no-price line shows', () => {
    expect(unpricedNoteOf({ ...ledgerOf([]), total: null, unpricedRows: 2 })).toBeNull()
    expect(unpricedNoteOf({ ...ledgerOf([]), total: 3, unpricedRows: 2 })).toBe('มี 2 session ที่ไม่มีราคาใน pricing.json')
  })

  test('the hover lists all five counts', () => {
    expect(tokenBreakdown(TOKENS).split('\n')).toHaveLength(5)
  })
})

describe('ledgerQuery', () => {
  test('today and yesterday are left to the server and a date is sent as it is', () => {
    expect(ledgerQuery('today')).toBe('day=today')
    expect(ledgerQuery('yesterday')).toBe('day=yesterday')
    expect(ledgerQuery('2026-05-10')).toBe('date=2026-05-10')
  })
})

describe('startLoading', () => {
  const shown = { data: ledgerOf([]), error: 'ledger_unavailable', loading: false, date: '2026-05-10' }

  test('another day clears the rows and the error', () => {
    expect(startLoading(shown, '2026-05-09')).toEqual({ data: null, error: null, loading: true, date: '2026-05-09' })
  })

  test('the same day keeps the rows while it loads again', () => {
    expect(startLoading(shown, '2026-05-10')).toEqual({ ...shown, loading: true })
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
