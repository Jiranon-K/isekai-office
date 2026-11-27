import { homedir } from 'node:os'
import { join } from 'node:path'
import { sumTokens, type Ledger, type LedgerRow, type TokenTotals } from '@shared/ledger'
import type { OfficeAgent } from '@shared/types'
import { baseNameOf, localFacts } from '../sources/local-facts'
import { createRecentFiles, type RecentFile } from '../sources/recent-files'
import { readTail } from '../sources/transcripts'
import { totalsForDay } from '../sources/usage'
import { createUsageReader } from '../sources/usage-reader'
import { costOf, loadPricing, priceFor, type Pricing } from './pricing'

const DAY_MS = 24 * 60 * 60 * 1000
const WINDOW_DAYS = 8
const REFRESH_MS = 30_000
const FALLBACK_TITLE = 'Claude'

type Label = { title: string; repo: string | null }

export type LedgerBuilderOptions = { projectsDir: string; now?: () => number }

export function startOfDay(date: string): number | null {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const start = new Date(year, month - 1, day)
  const roundTrip = [start.getFullYear(), start.getMonth() + 1, start.getDate()]
  return roundTrip.join('-') === [year, month, day].join('-') ? start.getTime() : null
}

function compareRows(first: LedgerRow, second: LedgerRow): number {
  if (first.cost !== null && second.cost !== null) {
    return second.cost - first.cost
  }
  if (first.cost !== null || second.cost !== null) {
    return first.cost === null ? 1 : -1
  }
  return sumTokens(second.tokens) - sumTokens(first.tokens)
}

function rowCost(pricing: Pricing | null, model: string | null, tokens: TokenTotals): number | null {
  const price = priceFor(pricing, model)
  return price ? costOf(price, tokens) : null
}

function summarise(date: string, rows: LedgerRow[], pricing: Pricing | null, at: number): Ledger {
  const priced = rows.filter((row) => row.cost !== null)
  const total = priced.length === 0 ? null : priced.reduce((sum, row) => sum + (row.cost ?? 0), 0)
  return {
    date,
    currency: pricing?.currency ?? null,
    rows: [...rows].sort(compareRows),
    total,
    unpricedRows: new Set(rows.filter((row) => row.cost === null).map((row) => row.session)).size,
    at
  }
}

export function createLedgerBuilder(options: LedgerBuilderOptions): { build(date: string, agents: OfficeAgent[]): Promise<Ledger | null> } {
  const now = options.now ?? Date.now
  const recent = createRecentFiles({ projectsDir: options.projectsDir, recentMs: WINDOW_DAYS * DAY_MS, refreshMs: REFRESH_MS, now })
  const reader = createUsageReader()
  const labels = new Map<string, { key: string; label: Label }>()

  async function labelFromFile(file: RecentFile): Promise<Label> {
    const key = `${file.modifiedAt}:${file.size}`
    const cached = labels.get(file.path)
    if (cached?.key === key) {
      return cached.label
    }
    const facts = localFacts((await readTail(file.path, file.size)).split('\n'))
    const label = { title: facts.title ?? FALLBACK_TITLE, repo: facts.cwd ? baseNameOf(facts.cwd) : null }
    labels.set(file.path, { key, label })
    return label
  }

  async function rowsOf(file: RecentFile, date: string, agents: OfficeAgent[], pricing: Pricing | null, counted: Set<string>): Promise<LedgerRow[]> {
    const state = await reader.read(file.path, file.size, file.modifiedAt)
    const models = totalsForDay(state, date, counted)
    if (models.size === 0) {
      return []
    }
    const agent = agents.find((candidate) => candidate.session === file.id || candidate.id === file.id) ?? null
    const label = agent ? { title: agent.title, repo: agent.repo } : await labelFromFile(file)
    return [...models].map(([model, tokens]) => {
      const modelName = model === '' ? null : model
      return { session: file.id, agentId: agent?.id ?? null, ...label, model: modelName, tokens, cost: rowCost(pricing, modelName, tokens) }
    })
  }

  async function build(date: string, agents: OfficeAgent[]): Promise<Ledger | null> {
    const dayStart = startOfDay(date)
    if (dayStart === null) {
      return null
    }
    const all = await recent.list()
    reader.keepOnly(new Set(all.map((file) => file.path)))
    const pricing = await loadPricing()
    const files = all.filter((file) => file.modifiedAt >= dayStart)
    const counted = new Set<string>()
    const rows: LedgerRow[] = []
    for (const file of files) {
      rows.push(...(await rowsOf(file, date, agents, pricing, counted)))
    }
    return summarise(date, rows, pricing, now())
  }

  return { build }
}

export const ledgerBuilder = createLedgerBuilder({ projectsDir: join(homedir(), '.claude', 'projects') })
