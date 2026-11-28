import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ArchiveListResponse } from '@shared/archive'
import type { OfficeAgent, SessionDetail } from '@shared/types'
import { demoArchiveList, demoArchiveSession } from './demo-archive'
import { handleArchive, type ArchiveRouteContext } from './routes'
import { createArchiveScanner } from './scan'

let folder = ''
let projectsDir = ''

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'isekai-archive-routes-'))
  projectsDir = join(folder, 'projects')
  mkdirSync(projectsDir, { recursive: true })
})

afterEach(() => {
  rmSync(folder, { recursive: true, force: true })
})

function makeAgent(id: string, session: string | null = id): OfficeAgent {
  return {
    id,
    title: `Agent ${id}`,
    repo: 'web-app',
    workspace: 'main',
    worktree: '/repo/web-app',
    session,
    contextTokens: 1000,
    state: 'working',
    tool: 'Edit',
    lastMessage: null,
    updatedAt: 1000,
    activeAt: 1000,
    terminal: null
  }
}

function callArchive(path: string, context: ArchiveRouteContext, method = 'GET'): Promise<Response | null> {
  return handleArchive(new Request(`http://localhost${path}`, { method }), context)
}

describe('demo archive fixtures', () => {
  test('provides 5 archived sessions across web-app, api, infra, and docs with first user prompts', () => {
    const now = 10_000_000_000
    const list = demoArchiveList({}, new Set(), now)
    expect(list.total).toBe(5)
    expect(list.sessions).toHaveLength(5)
    expect(new Set(list.sessions.map((session) => session.repo))).toEqual(new Set(['web-app', 'api', 'infra', 'docs']))
    for (const session of list.sessions) {
      expect(now - session.modifiedAt).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000)
      expect(now - session.modifiedAt).toBeLessThanOrEqual(48 * 60 * 60 * 1000)
      const detail = demoArchiveSession(session.id, now)
      expect(detail?.entries[0]?.role).toBe('user')
      expect((detail?.entries[0]?.text ?? '').length).toBeGreaterThan(20)
    }
  })
})

describe('handleArchive', () => {
  test('returns null for unrelated paths and non-GET requests', async () => {
    const context: ArchiveRouteContext = { demo: true, agents: () => [] }
    expect(await callArchive('/api/board', context)).toBeNull()
    expect(await callArchive('/api/archive', context, 'POST')).toBeNull()
    expect(await callArchive('/api/archive/arch-1', context, 'DELETE')).toBeNull()
  })

  test('rejects invalid and path-traversal IDs with 400 bad_request', async () => {
    const context: ArchiveRouteContext = { demo: false, agents: () => [], scanner: createArchiveScanner({ projectsDir }) }
    const badPaths = [
      '/api/archive/',
      '/api/archive/foo..bar',
      '/api/archive/..%2Fsecret',
      '/api/archive/a%2Fb',
      '/api/archive/a%5Cb',
      '/api/archive/nested/path',
      '/api/archive/has%20space',
      '/api/archive/%E0%A4%A',
      `/api/archive/${'a'.repeat(129)}`
    ]
    for (const path of badPaths) {
      const response = await callArchive(path, context)
      expect(response?.status).toBe(400)
      expect(await response?.json()).toEqual({ error: 'bad_request' })
    }
    expect(await callArchive('/api/archive/..', context)).toBeNull()
    expect(await callArchive('/api/archive/%2e%2e', context)).toBeNull()
  })

  test('serves demo list filtering, limit clamping, detail, and 404 for unknown session', async () => {
    const context: ArchiveRouteContext = { demo: true, agents: () => [makeAgent('arch-1')], now: () => 1_000_000_000 }
    const allResponse = await callArchive('/api/archive', context)
    expect(allResponse?.status).toBe(200)
    expect(allResponse?.headers.get('cache-control')).toBe('no-store')
    const all = (await allResponse?.json()) as ArchiveListResponse
    expect(all.total).toBe(5)
    expect(all.sessions[0]?.active).toBe(true)

    const apiOnly = (await (await callArchive('/api/archive?repo=api', context))?.json()) as ArchiveListResponse
    expect(apiOnly.sessions.map((session) => session.id)).toEqual(['arch-2'])

    const none = (await (await callArchive('/api/archive?q=zzzz', context))?.json()) as ArchiveListResponse
    expect(none.sessions).toEqual([])
    expect(none.total).toBe(0)

    const capped = (await (await callArchive('/api/archive?limit=2', context))?.json()) as ArchiveListResponse
    expect(capped.sessions).toHaveLength(2)
    expect(capped.truncated).toBe(true)

    const detail = (await (await callArchive('/api/archive/arch-2', context))?.json()) as SessionDetail
    expect(detail.id).toBe('arch-2')
    expect(detail.screen).toBeNull()
    expect(detail.entries[0]?.role).toBe('user')

    const missing = await callArchive('/api/archive/does-not-exist', context)
    expect(missing?.status).toBe(404)
    expect(await missing?.json()).toEqual({ error: 'session_not_found' })
  })

  test('serves live scanned transcripts and marks active by agent.session', async () => {
    const dir = join(projectsDir, 'repo-one')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'sess-42.jsonl'),
      [
        JSON.stringify({ type: 'user', cwd: '/code/payments', message: { content: 'Fix retry loop' } }),
        JSON.stringify({ type: 'custom-title', customTitle: 'Retry Loop Fix' }),
        JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Patched retry loop.' }] } })
      ].join('\n') + '\n'
    )
    const scanner = createArchiveScanner({ projectsDir })
    const context: ArchiveRouteContext = {
      demo: false,
      agents: () => [makeAgent('orca-99', 'sess-42')],
      scanner
    }

    const list = (await (await callArchive('/api/archive?q=retry', context))?.json()) as ArchiveListResponse
    expect(list.sessions).toHaveLength(1)
    expect(list.sessions[0]?.id).toBe('sess-42')
    expect(list.sessions[0]?.title).toBe('Retry Loop Fix')
    expect(list.sessions[0]?.repo).toBe('payments')
    expect(list.sessions[0]?.active).toBe(true)

    const detailResponse = await callArchive('/api/archive/sess-42', context)
    expect(detailResponse?.status).toBe(200)
    const detail = (await detailResponse?.json()) as SessionDetail
    expect(detail.entries.map((entry) => entry.text)).toEqual(['Fix retry loop', 'Patched retry loop.'])

    const missing = await callArchive('/api/archive/unknown-id', context)
    expect(missing?.status).toBe(404)
    expect(await missing?.json()).toEqual({ error: 'session_not_found' })
  })
})
