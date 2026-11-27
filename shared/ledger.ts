export type TokenTotals = {
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
}

export type LedgerRow = {
  session: string
  agentId: string | null
  title: string
  repo: string | null
  model: string | null
  tokens: TokenTotals
  cost: number | null
}

export type Ledger = {
  date: string
  currency: string | null
  rows: LedgerRow[]
  total: number | null
  unpricedRows: number
  at: number
}

export function emptyTokens(): TokenTotals {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }
}

export function addTokens(first: TokenTotals, second: TokenTotals): TokenTotals {
  return {
    input: first.input + second.input,
    output: first.output + second.output,
    cacheRead: first.cacheRead + second.cacheRead,
    cacheWrite5m: first.cacheWrite5m + second.cacheWrite5m,
    cacheWrite1h: first.cacheWrite1h + second.cacheWrite1h
  }
}

export function sumTokens(tokens: TokenTotals): number {
  return tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite5m + tokens.cacheWrite1h
}

export function goldOf(cost: number): number {
  return Math.round(cost * 100)
}
