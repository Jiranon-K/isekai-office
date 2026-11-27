import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { appendFileSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { totalsForDay } from './usage'
import { createUsageReader } from './usage-reader'
import { assistantLine, localNoon, usageOfSize } from './usage-fixtures'

const NOON = localNoon(2026, 5, 10)
const DAY = '2026-05-10'

let folder = ''
let path = ''

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'usage-reader-'))
  path = join(folder, 'session.jsonl')
})

afterEach(() => {
  rmSync(folder, { recursive: true, force: true })
})

function sizeOfFile(): number {
  return statSync(path).size
}

function inputOf(state: Awaited<ReturnType<ReturnType<typeof createUsageReader>['read']>>): number | undefined {
  return totalsForDay(state, DAY).get('claude-sonnet-x')?.input
}

function digits(value: number) {
  return { input: value, output: 1, cacheRead: 1, cacheWrite5m: 1, cacheWrite1h: 1 }
}

describe('usage reader', () => {
  test('appended lines are read from the old offset only', async () => {
    const reader = createUsageReader()
    writeFileSync(path, `${assistantLine('m1', NOON, usageOfSize(1))}\n`)
    await reader.read(path, sizeOfFile())
    const firstOffset = reader.offsetOf(path)
    expect(firstOffset).toBe(sizeOfFile())
    appendFileSync(path, `${assistantLine('m2', NOON, usageOfSize(10))}\n`)
    const state = await reader.read(path, sizeOfFile())
    expect(reader.offsetOf(path)).toBe(sizeOfFile())
    expect(reader.offsetOf(path)).toBeGreaterThan(firstOffset ?? 0)
    expect(inputOf(state)).toBe(11)
  })

  test('an unfinished last line is carried to the next read', async () => {
    const reader = createUsageReader()
    const line = assistantLine('m1', NOON, usageOfSize(3))
    writeFileSync(path, line.slice(0, 40))
    expect(inputOf(await reader.read(path, sizeOfFile()))).toBeUndefined()
    appendFileSync(path, `${line.slice(40)}\n`)
    expect(inputOf(await reader.read(path, sizeOfFile()))).toBe(3)
  })

  test('a multi byte character split across reads survives', async () => {
    const reader = createUsageReader()
    const line = JSON.stringify({ type: 'user', text: 'สวัสดี' })
    const bytes = Buffer.from(`${line}\n`)
    writeFileSync(path, bytes.subarray(0, 25))
    await reader.read(path, sizeOfFile())
    appendFileSync(path, bytes.subarray(25))
    await reader.read(path, sizeOfFile())
    expect(reader.offsetOf(path)).toBe(bytes.length)
  })

  test('a file that shrinks is read again from the start', async () => {
    const reader = createUsageReader()
    writeFileSync(path, `${assistantLine('m1', NOON, usageOfSize(1))}\n${assistantLine('m2', NOON, usageOfSize(1))}\n`)
    expect(inputOf(await reader.read(path, sizeOfFile()))).toBe(2)
    writeFileSync(path, `${assistantLine('m9', NOON, usageOfSize(5))}\n`)
    expect(inputOf(await reader.read(path, sizeOfFile()))).toBe(5)
    expect(reader.offsetOf(path)).toBe(sizeOfFile())
  })

  test('a file rewritten at the same size is read again when its modified time changed', async () => {
    const reader = createUsageReader()
    writeFileSync(path, `${assistantLine('m1', NOON, digits(1))}
`)
    utimesSync(path, new Date(2026, 4, 10, 8), new Date(2026, 4, 10, 8))
    expect(inputOf(await reader.read(path, sizeOfFile(), statSync(path).mtimeMs))).toBe(1)
    writeFileSync(path, `${assistantLine('m1', NOON, digits(2))}
`)
    utimesSync(path, new Date(2026, 4, 10, 9), new Date(2026, 4, 10, 9))
    expect(inputOf(await reader.read(path, sizeOfFile(), statSync(path).mtimeMs))).toBe(2)
  })

  test('a file replaced by a longer one with other first bytes is read again from the start', async () => {
    const reader = createUsageReader()
    const header = (note: string) => `${JSON.stringify({ type: 'user', note })}
`
    writeFileSync(path, `${header('aaaa')}${assistantLine('m1', NOON, usageOfSize(1))}
`)
    expect(inputOf(await reader.read(path, sizeOfFile(), statSync(path).mtimeMs))).toBe(1)
    writeFileSync(path, `${header('bbbb')}${assistantLine('m7', NOON, usageOfSize(7))}
${assistantLine('m8', NOON, usageOfSize(8))}
`)
    expect(inputOf(await reader.read(path, sizeOfFile(), statSync(path).mtimeMs))).toBe(15)
  })

  test('a broken line in the middle is skipped', async () => {
    const reader = createUsageReader()
    writeFileSync(path, `${assistantLine('m1', NOON, usageOfSize(1))}\nnot json\n${assistantLine('m2', NOON, usageOfSize(1))}\n`)
    expect(inputOf(await reader.read(path, sizeOfFile()))).toBe(2)
  })

  test('keepOnly forgets files that left the window', async () => {
    const reader = createUsageReader()
    writeFileSync(path, `${assistantLine('m1', NOON, usageOfSize(1))}\n`)
    await reader.read(path, sizeOfFile())
    reader.keepOnly(new Set())
    expect(reader.offsetOf(path)).toBeNull()
  })
})
