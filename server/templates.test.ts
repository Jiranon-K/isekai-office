import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BUILT_IN_TEMPLATES, type QuestTemplate } from '@shared/templates'
import { readTemplates, replaceTemplates, templatesPath } from './templates'

const original = process.env.ISEKAI_DATA_DIR
let folder = ''

const SAVED: QuestTemplate = { id: 'mine', name: 'ของฉัน', prompt: 'hello {{name}}', baseBranch: 'origin/dev', namePrefix: 'my-' }

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'isekai-templates-'))
  process.env.ISEKAI_DATA_DIR = folder
})

afterEach(async () => {
  if (original === undefined) {
    delete process.env.ISEKAI_DATA_DIR
  } else {
    process.env.ISEKAI_DATA_DIR = original
  }
  await rm(folder, { recursive: true, force: true })
})

describe('template store', () => {
  test('a missing file gives the built-in list and writes nothing', async () => {
    const reply = await readTemplates(false)
    expect(reply).toEqual({ status: 200, body: { templates: BUILT_IN_TEMPLATES } })
    expect(await readdir(folder)).toEqual([])
  })

  test('a saved list reads back, as after a restart', async () => {
    const saved = await replaceTemplates({ templates: [SAVED] }, false)
    expect(saved.status).toBe(200)
    expect(await readTemplates(false)).toEqual({ status: 200, body: { templates: [SAVED] } })
    expect(await readdir(folder)).toEqual(['templates.json'])
  })

  test('an empty saved list stays empty and does not fall back to the built-ins', async () => {
    await replaceTemplates({ templates: [] }, false)
    expect(await readTemplates(false)).toEqual({ status: 200, body: { templates: [] } })
  })

  test('an invalid list is refused and writes nothing', async () => {
    const reply = await replaceTemplates({ templates: [{ ...SAVED, baseBranch: '-x' }] }, false)
    expect(reply.status).toBe(400)
    expect(await readdir(folder)).toEqual([])
  })

  test('a refused list leaves the saved one in place', async () => {
    await replaceTemplates({ templates: [SAVED] }, false)
    await replaceTemplates({ templates: [SAVED, SAVED] }, false)
    expect(await readTemplates(false)).toEqual({ status: 200, body: { templates: [SAVED] } })
  })

  test('a broken file is reported and left untouched by a read', async () => {
    await writeFile(templatesPath(), '{ not json', 'utf8')
    const reply = await readTemplates(false)
    expect(reply).toEqual({ status: 500, body: { ok: false, error: 'unparseable' } })
    expect(await readFile(templatesPath(), 'utf8')).toBe('{ not json')
  })

  test('a file with an invalid list is reported as unparseable', async () => {
    await writeFile(templatesPath(), JSON.stringify({ templates: [{ id: 'X' }] }), 'utf8')
    expect((await readTemplates(false)).status).toBe(500)
  })

  test('demo serves the built-ins and accepts a valid put without writing', async () => {
    await writeFile(templatesPath(), JSON.stringify({ templates: [SAVED] }), 'utf8')
    expect(await readTemplates(true)).toEqual({ status: 200, body: { templates: BUILT_IN_TEMPLATES } })
    const before = await readFile(templatesPath(), 'utf8')
    expect((await replaceTemplates({ templates: [] }, true)).status).toBe(200)
    expect(await readFile(templatesPath(), 'utf8')).toBe(before)
    expect((await replaceTemplates({ templates: 1 }, true)).status).toBe(400)
  })
})
