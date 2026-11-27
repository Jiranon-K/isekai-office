import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentState, OfficeAgent, OfficeSnapshot } from '@shared/types'
import { localDate } from './events'
import { recordTick, recordWatch, resetRecorder, restoreRing } from './recorder'
import { appendDayEvents, listDays, logDirectory, readDay } from './store'

const NOW = new Date(2026, 10, 20, 12).getTime()
const TODAY = localDate(NOW)
let folder = ''
const saved = { dir: process.env.ISEKAI_DATA_DIR, cap: process.env.LOG_DAY_MAX_BYTES, keep: process.env.LOG_KEEP_DAYS }

function agentAt(id: string, state: AgentState, tool: string | null = null): OfficeAgent {
  return { id, title: `title ${id}`, repo: 'web', workspace: null, worktree: null, session: null, contextTokens: null, state, tool, lastMessage: null, updatedAt: 0, activeAt: 0, terminal: null }
}

function snapshotOf(agents: OfficeAgent[], at: number, extra: Partial<OfficeSnapshot> = {}): OfficeSnapshot {
  return { source: 'orca', caps: { command: true, spawn: true, screen: true }, sourceReady: true, agents, contextWindow: 1, quietAfterMs: 1, error: null, at, ...extra }
}

function restore(name: 'ISEKAI_DATA_DIR' | 'LOG_DAY_MAX_BYTES' | 'LOG_KEEP_DAYS', value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
    return
  }
  process.env[name] = value
}

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'isekai-recorder-'))
  process.env.ISEKAI_DATA_DIR = folder
  delete process.env.LOG_DAY_MAX_BYTES
  delete process.env.LOG_KEEP_DAYS
  resetRecorder()
})

afterEach(async () => {
  await rm(folder, { recursive: true, force: true })
  restore('ISEKAI_DATA_DIR', saved.dir)
  restore('LOG_DAY_MAX_BYTES', saved.cap)
  restore('LOG_KEEP_DAYS', saved.keep)
})

describe('recordTick', () => {
  test('a state change is one state line in todays file', async () => {
    await recordTick([agentAt('a', 'waiting')], snapshotOf([agentAt('a', 'done')], NOW))
    const { events } = await readDay(TODAY)
    expect(events).toEqual([{ kind: 'state', repo: 'web', at: NOW, agentId: 'a', title: 'title a', from: 'waiting', to: 'done' }])
  })

  test('moving from an edit tool to a read tool writes one station event, staying writes none', async () => {
    const edit = agentAt('a', 'working', 'Edit')
    await recordTick([edit], snapshotOf([edit], NOW))
    await recordTick([edit], snapshotOf([agentAt('a', 'working', 'Read')], NOW + 1))
    await recordTick([edit], snapshotOf([agentAt('a', 'working', 'Grep')], NOW + 2))
    const stations = (await readDay(TODAY)).events.filter((event) => event.kind === 'station')
    expect(stations.map((event) => event.kind === 'station' && event.station)).toEqual(['desk', 'archive'])
  })

  test('a snapshot with an error or a source that is not ready writes nothing', async () => {
    await recordTick([agentAt('a', 'working', 'Edit')], snapshotOf([agentAt('a', 'done')], NOW, { error: 'boom' }))
    await recordTick([agentAt('a', 'working', 'Edit')], snapshotOf([], NOW, { sourceReady: false }))
    expect(await listDays()).toEqual([])
  })

  test('the first snapshot has no state events but records where working agents stand', async () => {
    await recordTick(null, snapshotOf([agentAt('a', 'working', 'Bash'), agentAt('b', 'waiting')], NOW))
    expect((await readDay(TODAY)).events.map((event) => event.kind)).toEqual(['station'])
  })

  test('past the size cap state events are still written and station events are not', async () => {
    process.env.LOG_DAY_MAX_BYTES = '100'
    await appendDayEvents(TODAY, [{ kind: 'watch', at: 1, on: true }, { kind: 'watch', at: 2, on: false }, { kind: 'watch', at: 3, on: true }, { kind: 'watch', at: 4, on: false }, { kind: 'watch', at: 5, on: true }])
    await recordTick([agentAt('a', 'waiting')], snapshotOf([agentAt('a', 'working', 'Edit')], NOW))
    const kinds = (await readDay(TODAY)).events.map((event) => event.kind)
    expect(kinds.slice(5)).toEqual(['state'])
  })

  test('under the cap station events are written after the state events', async () => {
    await recordTick([agentAt('a', 'waiting')], snapshotOf([agentAt('a', 'working', 'Edit')], NOW))
    expect((await readDay(TODAY)).events.map((event) => event.kind)).toEqual(['state', 'station'])
  })
})

describe('recordWatch', () => {
  test('writes the on marker and then the off marker in order', async () => {
    await recordWatch(true, NOW)
    await recordWatch(false, NOW + 5)
    expect((await readDay(TODAY)).events).toEqual([{ kind: 'watch', at: NOW, on: true }, { kind: 'watch', at: NOW + 5, on: false }])
  })

  test('writes made without awaiting still land in call order', async () => {
    void recordWatch(true, NOW)
    await recordTick([agentAt('a', 'waiting')], snapshotOf([agentAt('a', 'done')], NOW + 1))
    await recordWatch(false, NOW + 2)
    expect((await readDay(TODAY)).events.map((event) => event.kind)).toEqual(['watch', 'state', 'watch'])
  })
})

describe('restoreRing', () => {
  test('gives back the state events already in todays file and prunes old days', async () => {
    process.env.LOG_KEEP_DAYS = '14'
    await appendDayEvents('2026-10-01', [{ kind: 'watch', at: 1, on: true }])
    await recordTick([agentAt('a', 'waiting')], snapshotOf([agentAt('a', 'done')], NOW))
    resetRecorder()
    const ring = await restoreRing(NOW)
    expect(ring).toEqual([{ at: NOW, agentId: 'a', title: 'title a', from: 'waiting', to: 'done' }])
    expect(await listDays()).toEqual([TODAY])
  })

  test('a day file that cannot be removed does not stop the ring from restoring', async () => {
    await appendDayEvents(TODAY, [{ kind: 'state', repo: null, at: NOW, agentId: 'a', title: 'title a', from: 'waiting', to: 'done' }])
    await mkdir(join(logDirectory(), '2026-01-01.jsonl'))
    const ring = await restoreRing(NOW)
    expect(ring.map((event) => event.agentId)).toEqual(['a'])
  })

  test('a failed prune loses no event and is retried on a later write', async () => {
    const stuck = join(logDirectory(), '2026-01-01.jsonl')
    await mkdir(stuck, { recursive: true })
    await recordWatch(true, NOW)
    await recordTick([agentAt('a', 'waiting')], snapshotOf([agentAt('a', 'done')], NOW + 1))
    expect((await readDay(TODAY)).events.map((event) => event.kind)).toEqual(['watch', 'state'])
    await rm(stuck, { recursive: true })
    await appendDayEvents('2026-01-01', [{ kind: 'watch', at: 1, on: true }])
    await recordWatch(false, NOW + 2)
    expect(await listDays()).toEqual([TODAY])
  })

  test('the date rolling over prunes again on the next write', async () => {
    process.env.LOG_KEEP_DAYS = '3'
    await restoreRing(NOW)
    await appendDayEvents('2026-11-10', [{ kind: 'watch', at: 1, on: true }])
    await recordWatch(true, NOW + 86_400_000)
    expect(await listDays()).toEqual([localDate(NOW + 86_400_000)])
  })
})
