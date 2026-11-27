import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { costOf, loadPricing, parsePricing, priceFor } from './pricing'

function entry(match: string, input: number) {
  return { match, input, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }
}

describe('priceFor', () => {
  const pricing = { currency: 'USD', models: [entry('sonnet', 1), entry('claude-sonnet', 2)] }

  test('the first entry contained in the model name wins', () => {
    expect(priceFor(pricing, 'claude-sonnet-x')?.input).toBe(1)
  })

  test('a model that matches nothing has no price', () => {
    expect(priceFor(pricing, 'other-model')).toBeNull()
    expect(priceFor(pricing, null)).toBeNull()
    expect(priceFor(null, 'claude-sonnet-x')).toBeNull()
  })
})

describe('costOf', () => {
  test('each count is priced per million tokens', () => {
    const price = { match: 'm', input: 1, output: 2, cacheRead: 3, cacheWrite5m: 4, cacheWrite1h: 5 }
    const tokens = { input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite5m: 500_000, cacheWrite1h: 200_000 }
    expect(costOf(price, tokens)).toBeCloseTo(1 + 2 + 3 + 2 + 1)
  })
})

describe('parsePricing', () => {
  test('a malformed file gives no pricing', () => {
    expect(parsePricing('{ nope')).toBeNull()
    expect(parsePricing('null')).toBeNull()
    expect(parsePricing('{"models": "x"}')).toBeNull()
    expect(parsePricing('{"models": [{"match": "a"}]}')).toBeNull()
    expect(parsePricing('{"models": [{"match": "a", "input": -1, "output": 0, "cacheRead": 0, "cacheWrite5m": 0, "cacheWrite1h": 0}]}')).toBeNull()
  })

  test('a valid file keeps its currency and entries in order', () => {
    const parsed = parsePricing(JSON.stringify({ currency: 'THB', models: [entry('a', 1), entry('b', 2)] }))
    expect(parsed?.currency).toBe('THB')
    expect(parsed?.models.map((model) => model.match)).toEqual(['a', 'b'])
  })
})

describe('loadPricing', () => {
  let folder = ''
  const previous = process.env.ISEKAI_DATA_DIR

  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), 'pricing-'))
    process.env.ISEKAI_DATA_DIR = folder
  })

  afterEach(() => {
    process.env.ISEKAI_DATA_DIR = previous
    if (previous === undefined) {
      delete process.env.ISEKAI_DATA_DIR
    }
    rmSync(folder, { recursive: true, force: true })
  })

  test('a missing file gives no pricing', async () => {
    expect(await loadPricing()).toBeNull()
  })

  test('the file in the data dir is read at call time', async () => {
    writeFileSync(join(folder, 'pricing.json'), JSON.stringify({ currency: 'USD', models: [entry('a', 1)] }))
    expect((await loadPricing())?.currency).toBe('USD')
  })

  test('a malformed file in the data dir gives no pricing', async () => {
    writeFileSync(join(folder, 'pricing.json'), 'garbage')
    expect(await loadPricing()).toBeNull()
  })

  test('an unusable file is reported once by name and still gives no pricing', async () => {
    const original = console.error
    const messages: string[] = []
    console.error = (...parts: unknown[]) => {
      messages.push(parts.join(' '))
    }
    try {
      writeFileSync(join(folder, 'pricing.json'), JSON.stringify({ currency: 'USD', models: [entry('a', 1), { match: 'b' }] }))
      expect(await loadPricing()).toBeNull()
      expect(await loadPricing()).toBeNull()
    } finally {
      console.error = original
    }
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain(join(folder, 'pricing.json'))
  })

  test('a missing file reports nothing', async () => {
    const original = console.error
    const messages: string[] = []
    console.error = (...parts: unknown[]) => {
      messages.push(parts.join(' '))
    }
    try {
      await loadPricing()
    } finally {
      console.error = original
    }
    expect(messages).toHaveLength(0)
  })
})
