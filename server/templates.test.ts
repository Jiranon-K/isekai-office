import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BUILT_IN_TEMPLATES, NO_FILE_REVISION, type QuestTemplate } from '@shared/templates'
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
    expect(reply).toEqual({ status: 200, body: { templates: BUILT_IN_TEMPLATES, revision: NO_FILE_REVISION } })
    expect(await readdir(folder)).toEqual([])
  })

  test('a saved list reads back, as after a restart', async () => {
    const saved = await replaceTemplates({ templates: [SAVED], revision: NO_FILE_REVISION }, false)
    expect(saved.status).toBe(200)
    expect(await readTemplates(false)).toEqual({ status: 200, body: { templates: [SAVED], revision: expect.any(String) } })
    expect(await readdir(folder)).toEqual(['templates.json'])
  })

  test('an empty saved list stays empty and does not fall back to the built-ins', async () => {
    await replaceTemplates({ templates: [], revision: NO_FILE_REVISION }, false)
    expect(await readTemplates(false)).toEqual({ status: 200, body: { templates: [], revision: expect.any(String) } })
  })

  test('an invalid list is refused and writes nothing', async () => {
    const reply = await replaceTemplates({ templates: [{ ...SAVED, baseBranch: '-x' }], revision: NO_FILE_REVISION }, false)
    expect(reply.status).toBe(400)
    expect(await readdir(folder)).toEqual([])
  })

  test('a refused list leaves the saved one in place', async () => {
    await replaceTemplates({ templates: [SAVED], revision: NO_FILE_REVISION }, false)
    await replaceTemplates({ templates: [SAVED, SAVED], revision: NO_FILE_REVISION }, false)
    expect(await readTemplates(false)).toEqual({ status: 200, body: { templates: [SAVED], revision: expect.any(String) } })
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
    expect(await readTemplates(true)).toEqual({ status: 200, body: { templates: BUILT_IN_TEMPLATES, revision: NO_FILE_REVISION } })
    const before = await readFile(templatesPath(), 'utf8')
    expect((await replaceTemplates({ templates: [], revision: NO_FILE_REVISION }, true)).status).toBe(200)
    expect(await readFile(templatesPath(), 'utf8')).toBe(before)
    expect((await replaceTemplates({ templates: 1, revision: NO_FILE_REVISION }, true)).status).toBe(400)
  })

  test('a save made against an older revision is refused as stale and writes nothing', async () => {
    await replaceTemplates({ templates: [SAVED], revision: NO_FILE_REVISION }, false)
    const loaded = await readTemplates(false)
    const revision = Reflect.get(loaded.body, 'revision')
    const other = { ...SAVED, id: 'other' }
    expect((await replaceTemplates({ templates: [SAVED, other], revision }, false)).status).toBe(200)
    const before = await readFile(templatesPath(), 'utf8')
    const stale = await replaceTemplates({ templates: [], revision }, false)
    expect(stale).toEqual({ status: 409, body: { ok: false, error: 'stale' } })
    expect(await readFile(templatesPath(), 'utf8')).toBe(before)
  })

  test('a save without a revision is refused', async () => {
    expect((await replaceTemplates({ templates: [SAVED] }, false)).status).toBe(400)
  })

  test('a save returns the new revision, which the next save can use', async () => {
    const first = await replaceTemplates({ templates: [SAVED], revision: NO_FILE_REVISION }, false)
    const revision = Reflect.get(first.body, 'revision')
    expect(revision).not.toBe(NO_FILE_REVISION)
    expect((await replaceTemplates({ templates: [], revision }, false)).status).toBe(200)
  })

  test('two saves from the same revision let only one win', async () => {
    const replies = await Promise.all([
      replaceTemplates({ templates: [SAVED], revision: NO_FILE_REVISION }, false),
      replaceTemplates({ templates: [], revision: NO_FILE_REVISION }, false)
    ])
    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 409])
  })
})
