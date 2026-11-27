import { addTokens, emptyTokens, localDay, type TokenTotals } from '@shared/ledger'

export type Usage = { id: string; model: string; day: string; tokens: TokenTotals }

export type UsageState = {
  entries: Map<string, Usage>
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
  return { entries: new Map() }
}

export function addUsage(state: UsageState, usage: Usage): void {
  state.entries.set(usage.id, usage)
}

export function totalsForDay(state: UsageState, day: string, counted: Set<string> = new Set()): Map<string, TokenTotals> {
  const combined = new Map<string, TokenTotals>()
  for (const usage of state.entries.values()) {
    if (usage.day !== day || counted.has(usage.id)) {
      continue
    }
    counted.add(usage.id)
    combined.set(usage.model, addTokens(combined.get(usage.model) ?? emptyTokens(), usage.tokens))
  }
  return combined
}
