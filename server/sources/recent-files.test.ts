import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRecentFiles } from './recent-files'

const MINUTE_MS = 60_000

let projectsDir = ''

beforeAll(async () => {
  projectsDir = await mkdtemp(join(tmpdir(), 'isekai-recent-'))
})

afterAll(async () => {
  await rm(projectsDir, { recursive: true, force: true })
})

async function transcript(folder: string, name: string, ageMs: number): Promise<string> {
  await mkdir(join(projectsDir, folder), { recursive: true })
  const path = join(projectsDir, folder, `${name}.jsonl`)
  await writeFile(path, '{}\n')
  const moment = new Date(Date.now() - ageMs)
  await utimes(path, moment, moment)
  return path
}

describe('recent files', () => {
  test('only files inside the window are listed, newest first, with the file name as id', async () => {
    await transcript('one', 'fresh', 1000)
    await transcript('one', 'newest', 10)
    await transcript('two', 'stale', 90 * MINUTE_MS)
    await writeFile(join(projectsDir, 'one', 'notes.txt'), 'x')
    const recent = createRecentFiles({ projectsDir, recentMs: 60 * MINUTE_MS, refreshMs: 30_000 })
    expect((await recent.list()).map((file) => file.id)).toEqual(['newest', 'fresh'])
  })

  test('a file that falls out of the window drops out of the list', async () => {
    const path = await transcript('drop', 'going', 1000)
    let clock = Date.now()
    const recent = createRecentFiles({ projectsDir, recentMs: 60 * MINUTE_MS, refreshMs: 30_000, now: () => clock })
    expect((await recent.list()).some((file) => file.id === 'going')).toBe(true)
    clock += 61 * MINUTE_MS
    expect((await recent.list()).some((file) => file.path === path)).toBe(false)
  })

  test('a new file in a new folder shows up on the next call without waiting for the refresh', async () => {
    const recent = createRecentFiles({ projectsDir, recentMs: 60 * MINUTE_MS, refreshMs: 3_600_000 })
    await recent.list()
    await transcript('brand-new', 'born', 5)
    expect((await recent.list()).some((file) => file.id === 'born')).toBe(true)
  })

  test('a missing projects folder gives an empty list', async () => {
    const recent = createRecentFiles({ projectsDir: join(projectsDir, 'nope'), recentMs: MINUTE_MS, refreshMs: 1000 })
    expect(await recent.list()).toEqual([])
  })
})
