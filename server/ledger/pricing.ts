import { join } from 'node:path'
import type { TokenTotals } from '@shared/ledger'
import { dataDir } from '../data-dir'

const PER_TOKENS = 1_000_000

export type ModelPrice = {
  match: string
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
}

export type Pricing = { currency: string | null; models: ModelPrice[] }

const PRICE_FIELDS = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'] as const

function isPrice(value: unknown): value is ModelPrice {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const entry = value as Record<string, unknown>
  if (typeof entry.match !== 'string' || entry.match === '') {
    return false
  }
  return PRICE_FIELDS.every((field) => typeof entry[field] === 'number' && Number.isFinite(entry[field]) && entry[field] >= 0)
}

export function parsePricing(text: string): Pricing | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  const body = parsed as { currency?: unknown; models?: unknown } | null
  if (!body || !Array.isArray(body.models) || !body.models.every(isPrice)) {
    return null
  }
  const currency = typeof body.currency === 'string' && body.currency !== '' ? body.currency : null
  return { currency, models: body.models }
}

let lastReported: string | null = null

function reportUnusable(path: string, text: string): void {
  const signature = `${path}:${text}`
  if (signature === lastReported) {
    return
  }
  lastReported = signature
  console.error(`pricing file ${path} cannot be used, no prices are applied`)
}

export async function loadPricing(): Promise<Pricing | null> {
  const path = join(dataDir(), 'pricing.json')
  const file = Bun.file(path)
  if (!(await file.exists())) {
    return null
  }
  const text = await file.text().catch(() => '')
  const pricing = parsePricing(text)
  if (pricing === null) {
    reportUnusable(path, text)
  }
  return pricing
}

export function priceFor(pricing: Pricing | null, model: string | null): ModelPrice | null {
  if (!pricing || !model) {
    return null
  }
  return pricing.models.find((entry) => model.includes(entry.match)) ?? null
}

export function costOf(price: ModelPrice, tokens: TokenTotals): number {
  const sum =
    tokens.input * price.input +
    tokens.output * price.output +
    tokens.cacheRead * price.cacheRead +
    tokens.cacheWrite5m * price.cacheWrite5m +
    tokens.cacheWrite1h * price.cacheWrite1h
  return sum / PER_TOKENS
}
