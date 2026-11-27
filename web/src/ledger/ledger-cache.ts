import type { Ledger } from '@shared/ledger'

type Entry = { startedAt: number; pending: Promise<Ledger> }

export type LedgerCache = { get(key: string, fresh?: boolean): Promise<Ledger> }

export function createLedgerCache(fetcher: (key: string) => Promise<Ledger>, now: () => number, lifetimeMs: number): LedgerCache {
  const entries = new Map<string, Entry>()

  function get(key: string, fresh = false): Promise<Ledger> {
    const known = entries.get(key)
    if (known && !fresh && now() - known.startedAt < lifetimeMs) {
      return known.pending
    }
    const entry = { startedAt: now(), pending: fetcher(key) }
    entries.set(key, entry)
    entry.pending.catch(() => {
      if (entries.get(key) === entry) {
        entries.delete(key)
      }
    })
    return entry.pending
  }

  return { get }
}
