import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DayLog, LogDays } from '@shared/day-log'
import { demoDay } from './demo-day'
import { handleDayLog } from './routes'
import { appendDayEvents } from './store'

let folder = ''
const originalDataDir = process.env.ISEKAI_DATA_DIR

async function get(path: string, demo = false): Promise<Response> {
  const response = await handleDayLog(new URL(`http://localhost:4300${path}`), demo)
  if (!response) {
    throw new Error('route not handled')
  }
  return response
}

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'isekai-routes-'))
  process.env.ISEKAI_DATA_DIR = folder
})

afterEach(async () => {
  await rm(folder, { recursive: true, force: true })
  if (originalDataDir === undefined) {
    delete process.env.ISEKAI_DATA_DIR
    return
  }
  process.env.ISEKAI_DATA_DIR = originalDataDir
})

describe('GET /api/log/days', () => {
  test('lists days newest first with the folder and the keep window', async () => {
    await appendDayEvents('2026-11-01', [{ kind: 'watch', at: 1, on: true }])
    await appendDayEvents('2026-11-02', [{ kind: 'watch', at: 1, on: true }])
    const body = (await (await get('/api/log/days')).json()) as LogDays
    expect(body.days).toEqual(['2026-11-02', '2026-11-01'])
    expect(body.directory).toBe(join(folder, 'log'))
    expect(body.keepDays).toBe(14)
  })

  test('demo mode lists the one made-up day and touches no disk', async () => {
    const body = (await (await get('/api/log/days', true)).json()) as LogDays
    expect(body.days).toEqual([demoDay().date])
  })
})

describe('GET /api/log/day', () => {
  test('returns the day log of a date', async () => {
    await appendDayEvents('2026-11-02', [{ kind: 'watch', at: 7, on: true }])
    const body = (await (await get('/api/log/day?date=2026-11-02')).json()) as DayLog
    expect(body).toEqual({ date: '2026-11-02', events: [{ kind: 'watch', at: 7, on: true }] })
  })

  test('a path in the date is refused with 400', async () => {
    expect((await get('/api/log/day?date=../../etc')).status).toBe(400)
    expect((await get('/api/log/day?date=2026-11-02%2F..')).status).toBe(400)
    expect((await get('/api/log/day')).status).toBe(400)
  })

  test('demo mode serves the made-up day and an empty day for any other date', async () => {
    const day = demoDay()
    const served = (await (await get(`/api/log/day?date=${day.date}`, true)).json()) as DayLog
    expect(served.events.length).toBe(day.events.length)
    const other = (await (await get('/api/log/day?date=2000-01-01', true)).json()) as DayLog
    expect(other.events).toEqual([])
  })
})

describe('other paths', () => {
  test('are left to the main router', async () => {
    expect(await handleDayLog(new URL('http://localhost:4300/api/log'), false)).toBeNull()
  })
})

describe('the made-up day', () => {
  test('is sorted by time and every state change follows from the one before it', () => {
    const { events } = demoDay()
    const times = events.map((event) => event.at)
    expect(times).toEqual([...times].sort((first, second) => first - second))
    const lastState = new Map<string, string | null>()
    for (const event of events) {
      if (event.kind !== 'state') {
        continue
      }
      expect(lastState.get(event.agentId) ?? null).toBe(event.from)
      lastState.set(event.agentId, event.to)
    }
  })
})
