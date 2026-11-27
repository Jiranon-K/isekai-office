import type { Ledger, LedgerRow, TokenTotals } from '@shared/ledger'
import { localDay } from '../sources/usage'

const DEMO_CURRENCY = 'USD'

type RowSeed = [session: string, title: string, repo: string, model: string | null, tokens: TokenTotals, cost: number | null]

const ROW_SEEDS: RowSeed[] = [
  ['a3', 'OPS-7 slow orders query', 'api', 'demo-large', { input: 41_200, output: 188_000, cacheRead: 9_400_000, cacheWrite5m: 610_000, cacheWrite1h: 120_000 }, 12.4],
  ['a1', 'APP-12 dark mode toggle', 'web-app', 'demo-large', { input: 22_800, output: 96_400, cacheRead: 5_100_000, cacheWrite5m: 330_000, cacheWrite1h: 0 }, 6.85],
  ['a7', 'APP-9 empty states', 'web-app', 'demo-medium', { input: 14_000, output: 51_000, cacheRead: 2_800_000, cacheWrite5m: 140_000, cacheWrite1h: 0 }, 1.92],
  ['a8', 'Write API changelog', 'docs', 'demo-small', { input: 3_100, output: 12_500, cacheRead: 410_000, cacheWrite5m: 22_000, cacheWrite1h: 0 }, 0.18],
  ['a4', 'Research rate limit options', 'api', 'mystery-model', { input: 9_900, output: 31_000, cacheRead: 1_200_000, cacheWrite5m: 80_000, cacheWrite1h: 0 }, null]
]

function rowFrom([session, title, repo, model, tokens, cost]: RowSeed): LedgerRow {
  return { session, agentId: session, title, repo, model, tokens, cost }
}

export function demoLedger(date: string, now = Date.now()): Ledger {
  if (date !== localDay(new Date(now))) {
    return { date, currency: DEMO_CURRENCY, rows: [], total: null, unpricedRows: 0, at: now }
  }
  const rows = ROW_SEEDS.map(rowFrom)
  const priced = rows.filter((row) => row.cost !== null)
  const total = priced.reduce((sum, row) => sum + (row.cost ?? 0), 0)
  return { date, currency: DEMO_CURRENCY, rows, total, unpricedRows: rows.length - priced.length, at: now }
}
