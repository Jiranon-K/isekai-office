import { describe, expect, test } from 'bun:test'
import type { Ledger } from '@shared/ledger'
import { createLedgerCache } from './ledger-cache'

function ledgerOf(at: number): Ledger {
  return { date: '2026-05-10', currency: null, rows: [], total: null, unpricedRows: 0, at }
}

function setup() {
  let clock = 0
  let calls = 0
  let failing = false
  const cache = createLedgerCache(
    async () => {
      calls += 1
      if (failing) {
        throw new Error('ledger_unavailable')
      }
      return ledgerOf(calls)
    },
    () => clock,
    30_000
  )
  return {
    cache,
    calls: () => calls,
    advance: (milliseconds: number) => {
      clock += milliseconds
    },
    fail: () => {
      failing = true
    }
  }
}

describe('ledger cache', () => {
  test('two readers within the lifetime share one fetch', async () => {
    const { cache, calls } = setup()
    const [first, second] = await Promise.all([cache.get('today'), cache.get('today')])
    expect(first).toBe(second)
    expect(calls()).toBe(1)
  })

  test('after the lifetime the next reader fetches again', async () => {
    const { cache, calls, advance } = setup()
    await cache.get('today')
    advance(29_000)
    await cache.get('today')
    expect(calls()).toBe(1)
    advance(2_000)
    await cache.get('today')
    expect(calls()).toBe(2)
  })

  test('a fresh read skips the cache and replaces it', async () => {
    const { cache, calls } = setup()
    await cache.get('today')
    const fresh = await cache.get('today', true)
    expect(calls()).toBe(2)
    expect(await cache.get('today')).toBe(fresh)
    expect(calls()).toBe(2)
  })

  test('a failed fetch is not kept', async () => {
    const { cache, calls, fail } = setup()
    fail()
    await expect(cache.get('today')).rejects.toThrow('ledger_unavailable')
    await expect(cache.get('today')).rejects.toThrow('ledger_unavailable')
    expect(calls()).toBe(2)
  })

  test('each key has its own entry', async () => {
    const { cache, calls } = setup()
    await cache.get('today')
    await cache.get('yesterday')
    expect(calls()).toBe(2)
  })
})
