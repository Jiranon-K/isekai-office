import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DayEvent } from '@shared/day-log'
import { appendDayEvents, dayFileBytes, listDays, logDirectory, parseDayText, pruneDays, readDay, readRecentStates } from './store'

let folder = ''
const originalDataDir = process.env.ISEKAI_DATA_DIR
const originalKeepDays = process.env.LOG_KEEP_DAYS

function stateAt(at: number, agentId = 'a'): DayEvent {
  return { kind: 'state', repo: null, at, agentId, title: `title ${agentId}`, from: 'working', to: 'done' }
}

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'isekai-store-'))
  process.env.ISEKAI_DATA_DIR = folder
  delete process.env.LOG_KEEP_DAYS
  delete process.env.LOG_DAY_MAX_BYTES
})

afterEach(async () => {
  await rm(folder, { recursive: true, force: true })
  originalDataDir === undefined ? delete process.env.ISEKAI_DATA_DIR : (process.env.ISEKAI_DATA_DIR = originalDataDir)
  originalKeepDays === undefined ? delete process.env.LOG_KEEP_DAYS : (process.env.LOG_KEEP_DAYS = originalKeepDays)
})

describe('append and read back', () => {
  test('each event is one json line in the day file, and reads back in order', async () => {
    await appendDayEvents('2026-11-03', [stateAt(1), { kind: 'watch', at: 2, on: false }])
    await appendDayEvents('2026-11-03', [stateAt(3)])
    const lines = (await readFile(join(logDirectory(), '2026-11-03.jsonl'), 'utf8')).trim().split('\n')
    expect(lines).toHaveLength(3)
    expect((await readDay('2026-11-03')).events.map((event) => event.at)).toEqual([1, 2, 3])
  })

  test('a file that ends in a torn line does not swallow the next batch', async () => {
    await mkdir(logDirectory(), { recursive: true })
    await writeFile(join(logDirectory(), '2026-11-03.jsonl'), `${JSON.stringify(stateAt(1))}\n{"kind":"sta`)
    await appendDayEvents('2026-11-03', [stateAt(2), stateAt(3)])
    expect((await readDay('2026-11-03')).events.map((event) => event.at)).toEqual([1, 2, 3])
  })

  test('past four times the day cap only watch markers are appended', async () => {
    process.env.LOG_DAY_MAX_BYTES = '100'
    const crowd = Array.from({ length: 6 }, (_, index) => stateAt(index))
    await appendDayEvents('2026-11-03', crowd)
    expect(await dayFileBytes('2026-11-03')).toBeGreaterThan(400)
    await appendDayEvents('2026-11-03', [stateAt(10), { kind: 'station', at: 11, agentId: 'a', station: 'desk' }, { kind: 'watch', at: 12, on: false }])
    const kinds = (await readDay('2026-11-03')).events.map((event) => event.kind)
    expect(kinds).toEqual(['state', 'state', 'state', 'state', 'state', 'state', 'watch'])
  })

  test('an empty batch creates no file', async () => {
    await appendDayEvents('2026-11-03', [])
    expect(await listDays()).toEqual([])
  })

  test('a day with no file is an empty day', async () => {
    expect(await readDay('2026-01-01')).toEqual({ date: '2026-01-01', events: [] })
  })

  test('broken and foreign lines are skipped', () => {
    const text = `${JSON.stringify(stateAt(1))}\nnot json\n{"kind":"other"}\n\n${JSON.stringify(stateAt(2))}\n`
    expect(parseDayText(text).map((event) => event.at)).toEqual([1, 2])
  })

  test('the file size is reported, zero when there is no file', async () => {
    expect(await dayFileBytes('2026-11-03')).toBe(0)
    await appendDayEvents('2026-11-03', [stateAt(1)])
    expect(await dayFileBytes('2026-11-03')).toBeGreaterThan(50)
  })
})

describe('listDays', () => {
  test('lists newest first and ignores other files', async () => {
    await appendDayEvents('2026-11-01', [stateAt(1)])
    await appendDayEvents('2026-11-03', [stateAt(1)])
    await writeFile(join(logDirectory(), 'notes.jsonl'), '')
    await writeFile(join(logDirectory(), '2026-11-02.txt'), '')
    expect(await listDays()).toEqual(['2026-11-03', '2026-11-01'])
  })

  test('an unreadable folder is no days', async () => {
    expect(await listDays()).toEqual([])
  })
})

describe('pruneDays', () => {
  test('removes days older than the keep window and keeps the rest', async () => {
    const now = new Date(2026, 10, 20, 12).getTime()
    process.env.LOG_KEEP_DAYS = '14'
    for (const date of ['2026-11-01', '2026-11-05', '2026-11-06', '2026-11-20']) {
      await appendDayEvents(date, [stateAt(1)])
    }
    expect(await pruneDays(now)).toEqual(['2026-11-05', '2026-11-01'])
    expect(await listDays()).toEqual(['2026-11-20', '2026-11-06'])
  })
})

describe('readRecentStates', () => {
  test('returns only state events, newest limit of them, as plain log events', async () => {
    await appendDayEvents('2026-11-03', [stateAt(1), { kind: 'watch', at: 2, on: true }, { kind: 'station', at: 3, agentId: 'a', station: 'desk' }, stateAt(4), stateAt(5)])
    const recent = await readRecentStates('2026-11-03', 2)
    expect(recent.map((event) => event.at)).toEqual([4, 5])
    expect(recent[0]).toEqual({ at: 4, agentId: 'a', title: 'title a', from: 'working', to: 'done' })
  })

  test('a big file is read from its tail without the cut first line', async () => {
    const events = Array.from({ length: 4000 }, (_, index) => stateAt(index))
    await appendDayEvents('2026-11-03', events)
    const recent = await readRecentStates('2026-11-03', 100)
    expect(recent).toHaveLength(100)
    expect(recent.at(-1)?.at).toBe(3999)
  })

  test('no file gives no events', async () => {
    expect(await readRecentStates('2026-11-03', 100)).toEqual([])
  })
})
