import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { appendFile, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { OfficeAgent } from '@shared/types'
import { createHintStore } from './hints'
import { createLocalSource, recentMsFrom } from './local'

const MINUTE_MS = 60_000

let projectsDir = ''
let folderCount = 0

beforeAll(async () => {
  projectsDir = await mkdtemp(join(tmpdir(), 'isekai-local-'))
})

afterAll(async () => {
  await rm(projectsDir, { recursive: true, force: true })
})

function line(record: Record<string, unknown>): string {
  return JSON.stringify(record)
}

function assistantEnd(cwd: string): string {
  const usage = { input_tokens: 10, cache_creation_input_tokens: 20, cache_read_input_tokens: 30 }
  return line({ type: 'assistant', cwd, message: { content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn', usage } })
}

function assistantTool(cwd: string): string {
  return line({ type: 'assistant', cwd, message: { content: [{ type: 'tool_use', name: 'Edit', input: {} }], stop_reason: 'tool_use' } })
}

async function session(id: string, lines: string[], ageMs = 1000): Promise<void> {
  folderCount += 1
  const folder = join(projectsDir, `folder-${folderCount}`)
  await mkdir(folder, { recursive: true })
  const path = join(folder, `${id}.jsonl`)
  await writeFile(path, lines.join('\n') + '\n')
  const moment = new Date(Date.now() - ageMs)
  await utimes(path, moment, moment)
}

function sourceOver(): ReturnType<typeof createLocalSource> {
  return createLocalSource({ projectsDir, recentMs: 60 * MINUTE_MS })
}

async function agentNamed(id: string): Promise<OfficeAgent | undefined> {
  return (await sourceOver().listAgents()).find((agent) => agent.id === id)
}

describe('local source fields', () => {
  test('a finished session has the file name as id and session, cwd as worktree, its base name as repo and no terminal', async () => {
    await session('sess-done', [line({ type: 'user', cwd: '/home/me/app', message: { content: 'hi' } }), assistantEnd('/home/me/app')])
    expect(await agentNamed('sess-done')).toMatchObject({
      id: 'sess-done',
      session: 'sess-done',
      worktree: '/home/me/app',
      repo: 'app',
      state: 'done',
      tool: null,
      contextTokens: 60,
      terminal: null,
      workspace: null
    })
  })

  test('a pending tool call is working at that tool', async () => {
    await session('sess-tool', [line({ type: 'user', cwd: '/x/y', message: { content: 'go' } }), assistantTool('/x/y')])
    expect(await agentNamed('sess-tool')).toMatchObject({ state: 'working', tool: 'Edit' })
  })

  test('a Windows path gives its last segment as repo', async () => {
    await session('sess-win', [assistantEnd('C:\\Users\\stell\\my_app')])
    expect(await agentNamed('sess-win')).toMatchObject({ worktree: 'C:\\Users\\stell\\my_app', repo: 'my_app', title: 'my_app' })
  })

  test('the worktree is the cwd of the last line that has one', async () => {
    await session('sess-cwd', [assistantEnd('/old/place'), line({ type: 'user', cwd: '/new/place', message: { content: 'cd' } }), line({ type: 'last-prompt' })])
    expect(await agentNamed('sess-cwd')).toMatchObject({ worktree: '/new/place', repo: 'place' })
  })
})

describe('local source titles', () => {
  test('the custom title wins over the ai title and the agent name', async () => {
    await session('title-custom', [assistantEnd('/a/b'), line({ type: 'agent-name', agentName: 'Agent' }), line({ type: 'ai-title', aiTitle: 'AI' }), line({ type: 'custom-title', customTitle: 'Custom' })])
    expect((await agentNamed('title-custom'))?.title).toBe('Custom')
  })

  test('the ai title wins over the agent name', async () => {
    await session('title-ai', [assistantEnd('/a/b'), line({ type: 'agent-name', agentName: 'Agent' }), line({ type: 'ai-title', aiTitle: 'AI' })])
    expect((await agentNamed('title-ai'))?.title).toBe('AI')
  })

  test('the agent name is used when nothing else is set', async () => {
    await session('title-agent', [assistantEnd('/a/b'), line({ type: 'agent-name', agentName: 'Agent' })])
    expect((await agentNamed('title-agent'))?.title).toBe('Agent')
  })

  test('the last title of a kind wins', async () => {
    await session('title-last', [line({ type: 'ai-title', aiTitle: 'First' }), assistantEnd('/a/b'), line({ type: 'ai-title', aiTitle: 'Second' })])
    expect((await agentNamed('title-last'))?.title).toBe('Second')
  })

  test('with no title the base name of cwd is used and with no cwd the name is Claude', async () => {
    await session('title-cwd', [assistantEnd('/a/b/project')])
    await session('title-none', [line({ type: 'user', message: { content: 'hi' } })])
    expect((await agentNamed('title-cwd'))?.title).toBe('project')
    expect((await agentNamed('title-none'))?.title).toBe('Claude')
  })
})

describe('local source window and history', () => {
  test('a session older than the window is not listed', async () => {
    await session('old-one', [assistantEnd('/a/b')], 120 * MINUTE_MS)
    expect(await agentNamed('old-one')).toBeUndefined()
  })

  test('the source is read only and always ready', async () => {
    const source = sourceOver()
    expect(source.caps).toEqual({ command: false, spawn: false, screen: false })
    expect(await source.ready()).toBe(true)
  })

  test('chat history of a local session is read from its transcript', async () => {
    await session('sess-chat', [line({ type: 'user', cwd: '/a/b', message: { content: 'hello there' } }), assistantEnd('/a/b')])
    const detail = await sourceOver().readSession('sess-chat', null)
    expect(detail.entries.map((entry) => entry.role)).toEqual(['user', 'assistant'])
    expect(detail.entries[0]?.text).toBe('hello there')
    expect(detail.screen).toBeNull()
  })
})

describe('local source hooks', () => {
  async function stateWith(hint: { state: 'working' | 'waiting' | 'done'; at: number } | null): Promise<OfficeAgent | undefined> {
    const hints = createHintStore()
    if (hint) {
      hints.apply({ sessionId: 'sess-hint', hint })
    }
    const source = createLocalSource({ projectsDir, recentMs: 60 * MINUTE_MS, hints })
    return (await source.listAgents()).find((agent) => agent.id === 'sess-hint')
  }

  test('a fresh waiting hint turns a working session to waiting and keeps its tool', async () => {
    await session('sess-hint', [line({ type: 'user', cwd: '/x/y', message: { content: 'go' } }), assistantTool('/x/y')])
    expect(await stateWith({ state: 'waiting', at: Date.now() })).toMatchObject({ state: 'waiting', tool: 'Edit' })
  })

  test('a transcript written long after the hint wins over it', async () => {
    await session('sess-hint', [line({ type: 'user', cwd: '/x/y', message: { content: 'go' } }), assistantTool('/x/y')])
    expect((await stateWith({ state: 'waiting', at: Date.now() - 60_000 }))?.state).toBe('working')
  })

  test('without a hint the transcript decides and a done hint clears the tool', async () => {
    await session('sess-hint', [line({ type: 'user', cwd: '/x/y', message: { content: 'go' } }), assistantTool('/x/y')])
    expect((await stateWith(null))?.state).toBe('working')
    expect(await stateWith({ state: 'done', at: Date.now() })).toMatchObject({ state: 'done', tool: null })
  })
})

describe('recent window setting', () => {
  test('minutes become milliseconds and a bad value gives sixty minutes', () => {
    expect(recentMsFrom('5')).toBe(5 * MINUTE_MS)
    for (const value of [undefined, '', 'abc', '0', '-1']) {
      expect(recentMsFrom(value)).toBe(60 * MINUTE_MS)
    }
  })
})

describe('local source title memory', () => {
  test('a title that scrolled out of the tail is kept for the file', async () => {
    const folder = join(projectsDir, 'folder-title-memory')
    await mkdir(folder, { recursive: true })
    const path = join(folder, 'sess-title.jsonl')
    const opening = [line({ type: 'custom-title', customTitle: 'Ship it' }), line({ type: 'user', cwd: '/p/app', message: { content: 'hi' } })]
    await writeFile(path, `${opening.join('\n')}\n`)
    const source = sourceOver()
    const first = (await source.listAgents()).find((agent) => agent.id === 'sess-title')
    expect(first?.title).toBe('Ship it')
    const filler = line({ type: 'user', cwd: '/p/app', message: { content: 'x'.repeat(2000) } })
    await appendFile(path, `${Array(200).fill(filler).join('\n')}\n${assistantEnd('/p/app')}\n`)
    const second = (await source.listAgents()).find((agent) => agent.id === 'sess-title')
    expect(second?.title).toBe('Ship it')
  })
})
