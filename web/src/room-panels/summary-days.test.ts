import { describe, expect, test } from 'bun:test'
import { summaryDayOptions } from './summary-days'

const NOW = new Date(2026, 4, 10, 15, 0).getTime()

describe('summaryDayOptions', () => {
  test('puts today and yesterday first even when the server lists no days', () => {
    expect(summaryDayOptions([], NOW)).toEqual([
      { date: '2026-05-10', label: 'วันนี้', ledgerDay: 'today' },
      { date: '2026-05-09', label: 'เมื่อวาน', ledgerDay: 'yesterday' }
    ])
  })

  test('asks the ledger for today and yesterday by name and for any other day by its date', () => {
    const options = summaryDayOptions(['2026-05-08'], NOW)
    expect(options.map((option) => option.ledgerDay)).toEqual(['today', 'yesterday', '2026-05-08'])
  })

  test('lists the other days newest first and does not repeat today or yesterday', () => {
    const options = summaryDayOptions(['2026-05-07', '2026-05-10', '2026-05-09', '2026-05-08'], NOW)
    expect(options.map((option) => option.date)).toEqual(['2026-05-10', '2026-05-09', '2026-05-08', '2026-05-07'])
    expect(options[2]?.label).toBe('2026-05-08')
  })
})
