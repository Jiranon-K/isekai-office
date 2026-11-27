import { addTokens, emptyTokens, localDay, type TokenTotals } from '@shared/ledger'

export type Usage = { id: string; model: string; day: string; tokens: TokenTotals }

export type UsageState = {
  totals: Map<string, Map<string, TokenTotals>>
  pending: Usage | null
}

function parseLine(line: string): Record<string, any> | null {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

export function dayOfTimestamp(timestamp: unknown): string | null {
  if (typeof timestamp !== 'string') {
    return null
  }
  const moment = new Date(timestamp)
  if (Number.isNaN(moment.getTime())) {
    return null
  }
  return localDay(moment)
}

function cacheWrites(usage: Record<string, any>): { fiveMinutes: number; oneHour: number } {
  const fiveMinutes = count(usage.cache_creation?.ephemeral_5m_input_tokens)
  const oneHour = count(usage.cache_creation?.ephemeral_1h_input_tokens)
  if (fiveMinutes + oneHour > 0) {
    return { fiveMinutes, oneHour }
  }
  return { fiveMinutes: count(usage.cache_creation_input_tokens), oneHour: 0 }
}

function tokensOf(usage: Record<string, any>): TokenTotals {
  const writes = cacheWrites(usage)
  return {
    input: count(usage.input_tokens),
    output: count(usage.output_tokens),
    cacheRead: count(usage.cache_read_input_tokens),
    cacheWrite5m: writes.fiveMinutes,
    cacheWrite1h: writes.oneHour
  }
}

export function usageOf(line: string): Usage | null {
  if (!line.includes('"usage"')) {
    return null
  }
  const parsed = parseLine(line)
  if (parsed?.type !== 'assistant' || !parsed.message?.usage || typeof parsed.message.id !== 'string') {
    return null
  }
  const day = dayOfTimestamp(parsed.timestamp)
  if (day === null) {
    return null
  }
  const model = typeof parsed.message.model === 'string' ? parsed.message.model : ''
  return { id: parsed.message.id, model, day, tokens: tokensOf(parsed.message.usage) }
}

export function createUsageState(): UsageState {
  return { totals: new Map(), pending: null }
}

function accumulate(totals: UsageState['totals'], usage: Usage): void {
  const models = totals.get(usage.day) ?? new Map<string, TokenTotals>()
  models.set(usage.model, addTokens(models.get(usage.model) ?? emptyTokens(), usage.tokens))
  totals.set(usage.day, models)
}

export function addUsage(state: UsageState, usage: Usage): void {
  if (state.pending?.id === usage.id) {
    state.pending = usage
    return
  }
  if (state.pending) {
    accumulate(state.totals, state.pending)
  }
  state.pending = usage
}

export function totalsForDay(state: UsageState, day: string): Map<string, TokenTotals> {
  const combined = new Map(state.totals.get(day) ?? [])
  if (state.pending?.day === day) {
    const { model, tokens } = state.pending
    combined.set(model, addTokens(combined.get(model) ?? emptyTokens(), tokens))
  }
  return combined
}
