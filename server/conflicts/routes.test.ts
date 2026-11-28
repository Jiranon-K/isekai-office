import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ConflictSnapshot } from '@shared/conflicts'
import type { OfficeAgent } from '@shared/types'
import { transcriptFolder } from '../sources/transcripts'
import { demoConflicts } from './demo-conflicts'
import { createConflictTracker, handleConflicts, type ConflictRouteContext } from './routes'

let folder = ''
let projectsDir = ''

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'isekai-conflicts-'))
  projectsDir = join(folder, 'projects')
  mkdirSync(projectsDir, { recursive: true })
})

afterEach(() => {
  rmSync(folder, { recursive: true, force: true })
})

function editLine(filePath: string): string {
  return JSON.stringify({
    type: 'assistant',
    message: {
      content: [{ type: 'tool_use', name: 'Edit', input: { file_path: filePath } }]
    }
  })
}

function makeAgent(id: string, worktree: string | null, state: OfficeAgent['state'] = 'working', repo = 'web-app'): OfficeAgent {
  return {
    id,
    title: `Agent ${id}`,
    repo,
    workspace: 'main',
    worktree,
    session: id,
    contextTokens: 1000,
    state,
    tool: 'Edit',
    lastMessage: null,
    updatedAt: 5000,
    activeAt: 5000,
    stateSince: 0,
    terminal: null
  }
}

function writeTranscript(worktree: string, sessionId: string, lines: string[]): string {
  const dir = transcriptFolder(worktree, projectsDir)
  mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `${sessionId}.jsonl`)
  writeFileSync(filePath, `${lines.join('\n')}\n`)
  return filePath
}

function requestConflicts(path: string, context: ConflictRouteContext, method = 'GET'): Promise<Response | null> {
  return handleConflicts(new Request(`http://localhost${path}`, { method }), context)
}

describe('demoConflicts', () => {
  test('returns two deterministic conflicts in web-app', () => {
    const snapshot = demoConflicts(1_000_000)
    expect(snapshot.at).toBe(1_000_000)
    expect(snapshot.conflicts).toEqual([
      { repo: 'web-app', path: 'src/checkout/cart.ts', agentIds: ['a1', 'a2'], updatedAt: 940_000 },
      { repo: 'web-app', path: 'src/checkout/summary.tsx', agentIds: ['a1', 'a5'], updatedAt: 880_000 }
    ])
  })
})

describe('handleConflicts and createConflictTracker', () => {
  test('returns null for unrelated paths and non-GET requests', async () => {
    const context: ConflictRouteContext = { demo: true, agents: () => [] }
    expect(await requestConflicts('/api/board', context)).toBeNull()
    expect(await requestConflicts('/api/conflicts', context, 'POST')).toBeNull()
  })

  test('returns demo conflicts in demo mode with no-store header', async () => {
    const response = await requestConflicts('/api/conflicts', { demo: true, agents: () => [], now: () => 500_000 })
    expect(response?.status).toBe(200)
    expect(response?.headers.get('cache-control')).toBe('no-store')
    const snapshot = (await response?.json()) as ConflictSnapshot
    expect(snapshot.conflicts.map((conflict) => conflict.path)).toEqual(['src/checkout/cart.ts', 'src/checkout/summary.tsx'])
    expect(snapshot.conflicts.map((conflict) => conflict.agentIds)).toEqual([['a1', 'a2'], ['a1', 'a5']])
  })

  test('computes live conflicts on demand, updates on append, and prunes departed agents from cache', async () => {
    const worktreeOne = join(folder, 'wt-1')
    const worktreeTwo = join(folder, 'wt-2')
    const fileOne = writeTranscript(worktreeOne, 's1', [editLine(join(worktreeOne, 'src', 'cart.ts'))])
    writeTranscript(worktreeTwo, 's2', [editLine(join(worktreeTwo, 'src', 'other.ts'))])

    const tracker = createConflictTracker({ projectsDir, now: () => 9000 })
    const a1 = makeAgent('s1', worktreeOne)
    const a2 = makeAgent('s2', worktreeTwo)

    const initialResponse = await requestConflicts('/api/conflicts', {
      demo: false,
      agents: () => [a1, a2],
      conflictsFor: tracker.conflictsFor
    })
    expect(initialResponse?.status).toBe(200)
    expect(await initialResponse?.json()).toEqual({ conflicts: [], at: 9000 })
    expect(tracker.cacheSize()).toBe(2)

    appendFileSync(fileOne, `${editLine(join(worktreeOne, 'src', 'other.ts'))}\n`)
    const updatedResponse = await requestConflicts('/api/conflicts', {
      demo: false,
      agents: () => [a1, a2],
      conflictsFor: tracker.conflictsFor
    })
    expect(await updatedResponse?.json()).toEqual({
      conflicts: [{ repo: 'web-app', path: 'src/other.ts', agentIds: ['s1', 's2'], updatedAt: 5000 }],
      at: 9000
    })

    const afterDeparture = await tracker.conflictsFor([a1, { ...a2, state: 'done' }])
    expect(afterDeparture.conflicts).toEqual([])
    expect(tracker.cacheSize()).toBe(1)
  })

  test('falls back to scanning projectsDir when worktree is null and skips missing transcripts', async () => {
    const subdir = join(projectsDir, 'orphan-project')
    mkdirSync(subdir, { recursive: true })
    writeFileSync(join(subdir, 's1.jsonl'), `${editLine('src/shared.ts')}\n`)
    writeFileSync(join(subdir, 's2.jsonl'), `${editLine('src/shared.ts')}\n`)

    const tracker = createConflictTracker({ projectsDir, now: () => 1234 })
    const snapshot = await tracker.conflictsFor([
      makeAgent('s1', null),
      makeAgent('s2', null),
      makeAgent('missing', null)
    ])
    expect(snapshot).toEqual({
      conflicts: [{ repo: 'web-app', path: 'src/shared.ts', agentIds: ['s1', 's2'], updatedAt: 5000 }],
      at: 1234
    })
    expect(tracker.cacheSize()).toBe(2)
  })

  test('switches transcript file when the same agent id starts a new session while the old file remains on disk', async () => {
    const worktreeOne = join(folder, 'wt-rotate-1')
    const worktreeTwo = join(folder, 'wt-rotate-2')
    writeTranscript(worktreeOne, 'session-1', [editLine(join(worktreeOne, 'src', 'first.ts'))])
    writeTranscript(worktreeOne, 'session-2', [editLine(join(worktreeOne, 'src', 'second.ts'))])
    writeTranscript(worktreeTwo, 'peer-session', [editLine(join(worktreeTwo, 'src', 'second.ts'))])

    const tracker = createConflictTracker({ projectsDir, now: () => 7777 })
    const orcaAgent = { ...makeAgent('orca-1', worktreeOne), session: 'session-1' }
    const peerAgent = { ...makeAgent('orca-2', worktreeTwo), session: 'peer-session' }

    const beforeSwitch = await tracker.conflictsFor([orcaAgent, peerAgent])
    expect(beforeSwitch).toEqual({ conflicts: [], at: 7777 })

    const afterSwitch = await tracker.conflictsFor([{ ...orcaAgent, session: 'session-2' }, peerAgent])
    expect(afterSwitch).toEqual({
      conflicts: [{ repo: 'web-app', path: 'src/second.ts', agentIds: ['orca-1', 'orca-2'], updatedAt: 5000 }],
      at: 7777
    })
  })
})
