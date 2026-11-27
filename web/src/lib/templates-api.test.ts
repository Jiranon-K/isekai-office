import { afterEach, describe, expect, test } from 'bun:test'
import { fetchTemplates, saveTemplates } from './templates-api'

const originalFetch = globalThis.fetch

function reply(status: number, body: unknown): void {
  globalThis.fetch = (async () => Response.json(body, { status })) as unknown as typeof fetch
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('templates api', () => {
  test('a fetch returns the list with its revision', async () => {
    reply(200, { templates: [], revision: 'abc' })
    expect(await fetchTemplates()).toEqual({ templates: [], revision: 'abc' })
  })

  test('a save sends the revision it loaded', async () => {
    let sent = ''
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sent = String(init.body)
      return Response.json({ templates: [], revision: 'next' })
    }) as unknown as typeof fetch
    const result = await saveTemplates([], 'abc')
    expect(JSON.parse(sent)).toEqual({ templates: [], revision: 'abc' })
    expect(result).toEqual({ ok: true, error: null, snapshot: { templates: [], revision: 'next' } })
  })

  test('a 409 is reported as stale', async () => {
    reply(409, { ok: false, error: 'stale' })
    expect(await saveTemplates([], 'abc')).toEqual({ ok: false, error: 'stale', snapshot: null })
  })

  test('another failure is reported as save_failed', async () => {
    reply(500, { ok: false, error: 'write_failed' })
    expect(await saveTemplates([], 'abc')).toEqual({ ok: false, error: 'save_failed', snapshot: null })
  })
})
