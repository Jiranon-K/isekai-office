import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BUILT_IN_TEMPLATES, NO_FILE_REVISION } from '@shared/templates'
import { isAllowedRequest } from './guard'
import { handleTemplates } from './templates-routes'

const PORT = 4300
const PORTS = { serverPort: 4302, publicPort: PORT }
const URL_OF = `http://localhost:${PORT}/api/templates`
const original = process.env.ISEKAI_DATA_DIR
let folder = ''

function put(body: unknown): Request {
  return new Request(URL_OF, {
    method: 'PUT',
    headers: { host: `localhost:${PORT}`, origin: `http://localhost:${PORT}`, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })
}

function template(id: string): Record<string, unknown> {
  return { id, name: id, prompt: 'p', baseBranch: null, namePrefix: null }
}

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'isekai-template-routes-'))
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

describe('templates routes', () => {
  test('get returns the built-in list when no file exists', async () => {
    const response = await handleTemplates(new Request(URL_OF), false)
    expect(response?.status).toBe(200)
    expect(await response?.json()).toEqual({ templates: BUILT_IN_TEMPLATES, revision: NO_FILE_REVISION })
  })

  test('put saves the list and get returns it', async () => {
    const saved = await handleTemplates(put({ templates: [template('a')], revision: NO_FILE_REVISION }), false)
    expect(saved?.status).toBe(200)
    const response = await handleTemplates(new Request(URL_OF), false)
    expect(await response?.json()).toEqual({ templates: [template('a')], revision: expect.any(String) })
  })

  test('put refuses 31 templates, a duplicate id, an empty name and a dashed branch with 400 and writes nothing', async () => {
    const thirtyOne = Array.from({ length: 31 }, (_, index) => template(`t-${index}`))
    const bodies = [
      { templates: thirtyOne, revision: NO_FILE_REVISION },
      { templates: [template('a'), template('a')], revision: NO_FILE_REVISION },
      { templates: [{ ...template('a'), name: '' }], revision: NO_FILE_REVISION },
      { templates: [{ ...template('a'), baseBranch: '-evil' }], revision: NO_FILE_REVISION }
    ]
    for (const body of bodies) {
      expect((await handleTemplates(put(body), false))?.status).toBe(400)
    }
    expect(await readdir(folder)).toEqual([])
  })

  test('put with a stale revision answers 409 and keeps the saved list', async () => {
    await handleTemplates(put({ templates: [template('a')], revision: NO_FILE_REVISION }), false)
    const loaded = await (await handleTemplates(new Request(URL_OF), false))?.json()
    await handleTemplates(put({ templates: [template('a'), template('b')], revision: loaded.revision }), false)
    const stale = await handleTemplates(put({ templates: [], revision: loaded.revision }), false)
    expect(stale?.status).toBe(409)
    expect(await stale?.json()).toEqual({ ok: false, error: 'stale' })
    const current = await (await handleTemplates(new Request(URL_OF), false))?.json()
    expect(current.templates).toEqual([template('a'), template('b')])
  })

  test('put refuses a body that is not json', async () => {
    expect((await handleTemplates(put('not json'), false))?.status).toBe(400)
  })

  test('get reports a broken file as an error', async () => {
    await Bun.write(join(folder, 'templates.json'), '{ broken')
    const response = await handleTemplates(new Request(URL_OF), false)
    expect(response?.status).toBe(500)
    expect(await response?.json()).toEqual({ ok: false, error: 'unparseable' })
  })

  test('other methods and paths are not handled here', async () => {
    expect(await handleTemplates(new Request(URL_OF, { method: 'DELETE' }), false)).toBeNull()
    expect(await handleTemplates(new Request(`http://localhost:${PORT}/api/other`), false)).toBeNull()
  })

  test('demo serves the built-ins and does not write', async () => {
    expect((await handleTemplates(put({ templates: [template('a')], revision: NO_FILE_REVISION }), true))?.status).toBe(200)
    const response = await handleTemplates(new Request(URL_OF), true)
    expect(await response?.json()).toEqual({ templates: BUILT_IN_TEMPLATES, revision: NO_FILE_REVISION })
    expect(await readdir(folder)).toEqual([])
  })
})

describe('templates guard', () => {
  test('a put from another origin is refused', () => {
    const request = put({ templates: [], revision: NO_FILE_REVISION })
    request.headers.set('origin', 'https://evil.example')
    expect(isAllowedRequest(request, PORTS)).toBe(false)
  })

  test('a put without an origin is refused', () => {
    const request = new Request(URL_OF, { method: 'PUT', headers: { host: `localhost:${PORT}`, 'content-type': 'application/json' }, body: '{}' })
    expect(isAllowedRequest(request, PORTS)).toBe(false)
  })

  test('a put from the app origin is allowed', () => {
    expect(isAllowedRequest(put({ templates: [], revision: NO_FILE_REVISION }), PORTS)).toBe(true)
  })
})
