import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Ledger } from '@shared/ledger'
import { localDay, sumTokens } from '@shared/ledger'
import { assistantLine, localNoon, usageOfSize } from '../sources/usage-fixtures'
import { createLedgerBuilder } from './build'
import { handleLedger } from './routes'

let folder = ''
let projects = ''
const previous = process.env.ISEKAI_DATA_DIR

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'ledger-'))
  projects = join(folder, 'projects', 'repo')
  mkdirSync(projects, { recursive: true })
  process.env.ISEKAI_DATA_DIR = join(folder, 'data')
  mkdirSync(process.env.ISEKAI_DATA_DIR, { recursive: true })
})

afterEach(() => {
  if (previous === undefined) {
    delete process.env.ISEKAI_DATA_DIR
  } else {
    process.env.ISEKAI_DATA_DIR = previous
  }
  rmSync(folder, { recursive: true, force: true })
})

function today(): string {
  return localDay(new Date())
}

function ask(path: string, demo = false, builder = createLedgerBuilder({ projectsDir: join(folder, 'projects') })): Promise<Response | null> {
  return handleLedger(new URL(`http://localhost${path}`), { demo, agents: () => [], build: builder.build })
}

function writeSession(name: string, lines: string[]): void {
  writeFileSync(join(projects, `${name}.jsonl`), `${lines.join('\n')}\n`)
}

describe('GET /api/ledger', () => {
  test('other paths are not handled', async () => {
    expect(await ask('/api/board')).toBeNull()
  })

  test('a bad date is a 400', async () => {
    for (const date of ['yesterday', '2026-5-1', '2026-02-31', '']) {
      const response = await ask(`/api/ledger?date=${date}`)
      expect(response?.status).toBe(400)
    }
    expect((await ask('/api/ledger?date=nope', true))?.status).toBe(400)
  })

  test('with no pricing file the rows carry tokens and no cost', async () => {
    writeSession('s1', [assistantLine('m1', new Date().toISOString(), usageOfSize(1)), assistantLine('m1', new Date().toISOString(), usageOfSize(1))])
    const response = await ask('/api/ledger')
    const ledger = (await response?.json()) as Ledger
    expect(response?.status).toBe(200)
    expect(ledger.date).toBe(today())
    expect(ledger.currency).toBeNull()
    expect(ledger.total).toBeNull()
    expect(ledger.rows).toHaveLength(1)
    expect(ledger.rows[0]?.cost).toBeNull()
    expect(sumTokens(ledger.rows[0]?.tokens ?? usageOfSize(0))).toBe(sumTokens(usageOfSize(1)))
    expect(ledger.unpricedRows).toBe(1)
  })

  test('an unmatched model is left out of the total and counted', async () => {
    const zero = { input: 1000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }
    writeFileSync(join(process.env.ISEKAI_DATA_DIR ?? '', 'pricing.json'), JSON.stringify({ currency: 'USD', models: [{ match: 'known', ...zero }] }))
    const now = new Date().toISOString()
    writeSession('s1', [assistantLine('m1', now, { ...zero, input: 1_000_000 }, 'known-model'), assistantLine('m2', now, zero, 'mystery')])
    const ledger = (await (await ask('/api/ledger'))?.json()) as Ledger
    expect(ledger.currency).toBe('USD')
    expect(ledger.total).toBeCloseTo(1000)
    expect(ledger.unpricedRows).toBe(1)
    expect(ledger.rows.map((row) => row.model)).toEqual(['known-model', 'mystery'])
  })

  test('yesterday and today are separate ledgers', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const stamp = localNoon(yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate())
    writeSession('s1', [assistantLine('m1', stamp, usageOfSize(1)), assistantLine('m2', new Date().toISOString(), usageOfSize(2))])
    const asked = async (date: string) => ((await (await ask(`/api/ledger?date=${date}`))?.json()) as Ledger).rows[0]?.tokens.input
    expect(await asked(localDay(yesterday))).toBe(1)
    expect(await asked(today())).toBe(2)
  })

  test('asking again reads only what was appended', async () => {
    const builder = createLedgerBuilder({ projectsDir: join(folder, 'projects') })
    const now = new Date().toISOString()
    writeSession('s1', [assistantLine('m1', now, usageOfSize(1))])
    await ask('/api/ledger', false, builder)
    appendFileSync(join(projects, 's1.jsonl'), `${assistantLine('m2', now, usageOfSize(1))}\n`)
    const ledger = (await (await ask('/api/ledger', false, builder))?.json()) as Ledger
    expect(ledger.rows[0]?.tokens.input).toBe(2)
  })

  test('a resumed session that repeats old lines in a new file is counted once', async () => {
    const now = new Date().toISOString()
    writeSession('s1', [assistantLine('m1', now, usageOfSize(1)), assistantLine('m2', now, usageOfSize(2))])
    writeSession('s2', [assistantLine('m2', now, usageOfSize(2)), assistantLine('m3', now, usageOfSize(4))])
    const ledger = (await (await ask('/api/ledger'))?.json()) as Ledger
    const input = ledger.rows.reduce((sum, row) => sum + row.tokens.input, 0)
    expect(input).toBe(7)
  })

  test('unpriced rows count sessions, not rows', async () => {
    const zero = { input: 1000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }
    writeFileSync(join(process.env.ISEKAI_DATA_DIR ?? '', 'pricing.json'), JSON.stringify({ currency: 'USD', models: [{ match: 'known', ...zero }] }))
    const now = new Date().toISOString()
    writeSession('s1', [assistantLine('m1', now, usageOfSize(1), 'one'), assistantLine('m2', now, usageOfSize(1), 'two'), assistantLine('m3', now, usageOfSize(1), 'known')])
    const ledger = (await (await ask('/api/ledger'))?.json()) as Ledger
    expect(ledger.rows).toHaveLength(3)
    expect(ledger.unpricedRows).toBe(1)
  })

  test('a first request reads one file at a time in chunks of at most one megabyte', async () => {
    const now = new Date().toISOString()
    const filler = 'x'.repeat(2000)
    const bigSession = (prefix: string) => Array.from({ length: 800 }, (_, index) => assistantLine(`${prefix}${index}`, now, usageOfSize(1)).replace('"usage"', `"filler":"${filler}","usage"`))
    writeSession('s1', bigSession('a'))
    writeSession('s2', bigSession('b'))
    const original = Bun.file
    let running = 0
    let mostRunning = 0
    let largest = 0
    const patched = (...args: Parameters<typeof Bun.file>) => {
      const file = original(...args)
      const slice = file.slice.bind(file)
      file.slice = ((from?: number, to?: number, type?: string) => {
        largest = Math.max(largest, (to ?? 0) - (from ?? 0))
        const part = slice(from, to, type)
        const buffer = part.arrayBuffer.bind(part)
        part.arrayBuffer = async () => {
          running += 1
          mostRunning = Math.max(mostRunning, running)
          await Bun.sleep(5)
          running -= 1
          return buffer()
        }
        return part
      }) as typeof file.slice
      return file
    }
    Bun.file = patched as typeof Bun.file
    try {
      const ledger = (await (await ask('/api/ledger'))?.json()) as Ledger
      expect(ledger.rows.reduce((sum, row) => sum + row.tokens.input, 0)).toBe(1600)
    } finally {
      Bun.file = original
    }
    expect(largest).toBeGreaterThan(0)
    expect(largest).toBeLessThanOrEqual(1024 * 1024)
    expect(mostRunning).toBe(1)
  })

  test('the server decides today and yesterday from its own clock', async () => {
    const before = new Date()
    const yesterday = new Date(before.getFullYear(), before.getMonth(), before.getDate() - 1)
    const dateOf = async (query: string, demo = false) => ((await (await ask(`/api/ledger?${query}`, demo))?.json()) as Ledger).date
    expect(await dateOf('day=today')).toBe(today())
    expect(await dateOf('day=yesterday')).toBe(localDay(yesterday))
    expect(await dateOf('day=yesterday', true)).toBe(localDay(yesterday))
    expect(await dateOf('date=2026-05-10&day=today')).toBe('2026-05-10')
    expect((await ask('/api/ledger?day=tomorrow'))?.status).toBe(400)
  })

  test('demo mode serves one unpriced row', async () => {
    const ledger = (await (await ask('/api/ledger', true))?.json()) as Ledger
    expect(ledger.rows.length).toBeGreaterThan(1)
    expect(ledger.unpricedRows).toBe(1)
    expect(ledger.total).not.toBeNull()
  })
})
