import { describe, expect, test } from 'bun:test'
import type { AgentDiff, DiffSummaryResponse } from '@shared/diff'
import type { OfficeAgent } from '@shared/types'
import { handleDiff, type DiffRouteContext } from './routes'

function makeAgent(id: string, worktree: string | null): OfficeAgent {
  return {
    id,
    title: `Agent ${id}`,
    repo: 'app',
    workspace: 'main',
    worktree,
    session: id,
    contextTokens: 1000,
    state: 'working',
    tool: 'Edit',
    lastMessage: null,
    updatedAt: 1,
    activeAt: 1,
    stateSince: 0,
    terminal: null
  }
}

function get(path: string, context: DiffRouteContext, method = 'GET'): Promise<Response | null> {
  return handleDiff(new Request(`http://localhost${path}`, { method }), context)
}

describe('handleDiff', () => {
  test('returns null for unrelated paths and non-GET methods', async () => {
    const context: DiffRouteContext = { demo: false, agents: () => [] }
    expect(await get('/api/board', context)).toBeNull()
    expect(await get('/api/diff/', context)).toBeNull()
    expect(await get('/api/diff/a1/extra', context)).toBeNull()
    expect(await get('/api/diff/a1', context, 'POST')).toBeNull()
    expect(await get('/api/diff-summary?ids=a1', context, 'POST')).toBeNull()
  })

  test('returns 404 agent_not_found for unknown agent in both real and demo mode', async () => {
    const agents = [makeAgent('a1', '/tmp/worktree-a1')]
    const realResponse = await get('/api/diff/missing', { demo: false, agents: () => agents })
    expect(realResponse?.status).toBe(404)
    expect(await realResponse?.json()).toEqual({ error: 'agent_not_found' })

    const demoResponse = await get('/api/diff/missing', { demo: true, agents: () => agents })
    expect(demoResponse?.status).toBe(404)
    expect(await demoResponse?.json()).toEqual({ error: 'agent_not_found' })
  })

  test('returns 200 no_worktree when real agent has null worktree', async () => {
    let called = false
    const response = await get('/api/diff/a6', {
      demo: false,
      agents: () => [makeAgent('a6', null)],
      readDiff: async () => {
        called = true
        throw new Error('should not be called')
      }
    })
    expect(response?.status).toBe(200)
    expect(response?.headers.get('cache-control')).toBe('no-store')
    expect(await response?.json()).toEqual({
      agentId: 'a6',
      branch: null,
      files: [],
      totalAdded: 0,
      totalRemoved: 0,
      truncated: false,
      error: 'no_worktree'
    })
    expect(called).toBe(false)
  })

  test('calls readDiff for real agent with worktree', async () => {
    const expected: AgentDiff = {
      agentId: 'a1',
      branch: 'feat/test',
      files: [{ path: 'src/a.ts', status: 'modified', added: 8, removed: 2 }],
      totalAdded: 8,
      totalRemoved: 2,
      truncated: false,
      error: null
    }
    const response = await get('/api/diff/a1', {
      demo: false,
      agents: () => [makeAgent('a1', '/repo/a1')],
      readDiff: async (agentId, worktree) => {
        expect(agentId).toBe('a1')
        expect(worktree).toBe('/repo/a1')
        return expected
      }
    })
    expect(response?.status).toBe(200)
    expect(await response?.json()).toEqual(expected)
  })

  test('serves demo fixtures in demo mode', async () => {
    const agents = [makeAgent('a1', null), makeAgent('a6', null), makeAgent('a8', null), makeAgent('a2', null)]
    const a1 = (await (await get('/api/diff/a1', { demo: true, agents: () => agents }))?.json()) as AgentDiff
    const a6 = (await (await get('/api/diff/a6', { demo: true, agents: () => agents }))?.json()) as AgentDiff
    const a8 = (await (await get('/api/diff/a8', { demo: true, agents: () => agents }))?.json()) as AgentDiff
    const a2 = (await (await get('/api/diff/a2', { demo: true, agents: () => agents }))?.json()) as AgentDiff
    expect(a1.branch).toBe('feat/dark-mode')
    expect(a1.totalAdded).toBe(64)
    expect(a6.error).toBe('no_worktree')
    expect(a8.files).toEqual([])
    expect(a8.error).toBeNull()
    expect(a2.totalAdded).toBe(14)
  })

  test('GET /api/diff-summary returns summaries for known, clean, missing, and unknown IDs', async () => {
    const agents = [makeAgent('a1', '/repo/a1'), makeAgent('a2', '/repo/a2'), makeAgent('a6', null), makeAgent('a9', '/repo/broken')]
    const response = await get('/api/diff-summary?ids=a1,a2,a6,a9,nope', {
      demo: false,
      agents: () => agents,
      readDiff: async (agentId) => {
        if (agentId === 'a1') {
          return {
            agentId,
            branch: 'main',
            files: [{ path: 'a.ts', status: 'modified', added: 10, removed: 3 }],
            totalAdded: 10,
            totalRemoved: 3,
            truncated: false,
            error: null
          }
        }
        if (agentId === 'a2') {
          return { agentId, branch: 'main', files: [], totalAdded: 0, totalRemoved: 0, truncated: false, error: null }
        }
        return { agentId, branch: null, files: [], totalAdded: 0, totalRemoved: 0, truncated: false, error: 'git_unavailable' }
      }
    })
    expect(response?.status).toBe(200)
    const payload = (await response?.json()) as DiffSummaryResponse
    expect(payload).toEqual({
      summaries: [
        { agentId: 'a1', files: 1, added: 10, removed: 3, clean: false, unavailable: false },
        { agentId: 'a2', files: 0, added: 0, removed: 0, clean: true, unavailable: false },
        { agentId: 'a6', files: 0, added: 0, removed: 0, clean: false, unavailable: true },
        { agentId: 'a9', files: 0, added: 0, removed: 0, clean: false, unavailable: true },
        { agentId: 'nope', files: 0, added: 0, removed: 0, clean: false, unavailable: true }
      ]
    })
  })

  test('GET /api/diff-summary in demo mode returns a7, a8, a6 and caps ids at 20', async () => {
    const agents = [makeAgent('a7', null), makeAgent('a8', null), makeAgent('a6', null)]
    const response = await get('/api/diff-summary?ids=a7,a8,a6,unknown', { demo: true, agents: () => agents })
    const payload = (await response?.json()) as DiffSummaryResponse
    expect(payload.summaries).toEqual([
      { agentId: 'a7', files: 4, added: 112, removed: 29, clean: false, unavailable: false },
      { agentId: 'a8', files: 0, added: 0, removed: 0, clean: true, unavailable: false },
      { agentId: 'a6', files: 0, added: 0, removed: 0, clean: false, unavailable: true },
      { agentId: 'unknown', files: 0, added: 0, removed: 0, clean: false, unavailable: true }
    ])

    const manyIds = Array.from({ length: 25 }, (_, index) => `id-${index}`).join(',')
    const cappedResponse = await get(`/api/diff-summary?ids=${manyIds}`, { demo: true, agents: () => [] })
    const cappedPayload = (await cappedResponse?.json()) as DiffSummaryResponse
    expect(cappedPayload.summaries).toHaveLength(20)
  })

  test('GET /api/diff-summary with empty ids returns empty list', async () => {
    const response = await get('/api/diff-summary', { demo: false, agents: () => [] })
    expect(response?.status).toBe(200)
    expect(await response?.json()).toEqual({ summaries: [] })
  })
})
