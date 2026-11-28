import { describe, expect, test } from 'bun:test'
import type { ParsedStreamEvent } from './protocol'
import { applyStreamEvent, consumeStreamLines, sessionToAgent, sessionToDetail, type ManagedSession } from './session'

function streamOf(chunks: Array<string | Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
      }
      controller.close()
    }
  })
}

async function collectLines(chunks: Array<string | Uint8Array>): Promise<string[]> {
  const lines: string[] = []
  await consumeStreamLines(streamOf(chunks), (line) => {
    lines.push(line)
  })
  return lines
}

function makeSession(): ManagedSession {
  return {
    id: 'managed-1',
    sessionId: 's-1',
    title: 'fix-auth',
    repo: 'app',
    worktree: '/work/app',
    state: 'working',
    tool: null,
    lastMessage: null,
    contextTokens: null,
    updatedAt: 0,
    activeAt: 0,
    pendingRequestId: null,
    screenLines: [],
    entries: [],
    process: null,
    exitedAt: null
  }
}

describe('consumeStreamLines', () => {
  test('joins a line cut across chunks, even when a Thai character is split mid-bytes', async () => {
    const bytes = new TextEncoder().encode('{"text":"สวัสดี"}\n{"b":2}\n')
    const lines = await collectLines([bytes.slice(0, 10), bytes.slice(10, 20), bytes.slice(20)])
    expect(lines).toEqual(['{"text":"สวัสดี"}', '{"b":2}'])
  })

  test('flushes a last line that has no trailing newline, and skips a blank tail', async () => {
    expect(await collectLines(['{"a":1}\n{"b":2}'])).toEqual(['{"a":1}', '{"b":2}'])
    expect(await collectLines(['x\n   '])).toEqual(['x'])
  })

  test('keeps a line under 64 KB and drops an oversized one up to the next newline', async () => {
    const kept = 'k'.repeat(60 * 1024)
    const oversized = 'o'.repeat(70 * 1024)
    const lines = await collectLines([`${kept}\n${oversized}`, 'still-oversized\nnext\n'])
    expect(lines).toEqual([kept, 'next'])
  })

  test('drops an oversized final line that never reaches a newline', async () => {
    expect(await collectLines(['x'.repeat(65 * 1024)])).toEqual([])
  })
})

describe('applyStreamEvent', () => {
  test('a control request makes the session waiting on that tool', () => {
    const session = makeSession()
    const event: ParsedStreamEvent = {
      kind: 'control_request',
      requestId: 'perm-1',
      toolName: 'Bash',
      input: { command: 'bun test' },
      screen: '⏺ Bash(bun test)'
    }
    expect(applyStreamEvent(session, event, 5)).toBe(true)
    const agent = sessionToAgent(session)
    expect(agent.state).toBe('waiting')
    expect(agent.tool).toBe('Bash')
    expect(agent.lastMessage).toBe('Allow Bash?')
    expect(sessionToDetail(session).screen).toContain('⏺ Bash(bun test)')
  })

  test('assistant tool use keeps the session working and shows the last tool', () => {
    const session = makeSession()
    applyStreamEvent(session, { kind: 'assistant', text: '', tools: ['Read', 'Edit'], contextTokens: 1200 }, 7)
    const agent = sessionToAgent(session)
    expect(agent.state).toBe('working')
    expect(agent.tool).toBe('Edit')
    expect(agent.contextTokens).toBe(1200)
  })

  test('a result ends the session, clears the tool and shows its text', () => {
    const session = makeSession()
    applyStreamEvent(session, { kind: 'assistant', text: '', tools: ['Bash'], contextTokens: null }, 1)
    applyStreamEvent(session, { kind: 'result', text: 'เสร็จแล้ว', isError: false }, 2)
    const agent = sessionToAgent(session)
    expect(agent.state).toBe('done')
    expect(agent.tool).toBeNull()
    expect(agent.lastMessage).toBe('เสร็จแล้ว')
  })

  test('a system event updates the session id and repo name from its cwd', () => {
    const session = makeSession()
    applyStreamEvent(session, { kind: 'system', sessionId: 's-2', cwd: '/work/other' }, 3)
    const agent = sessionToAgent(session)
    expect(agent.session).toBe('s-2')
    expect(agent.repo).toBe('other')
    expect(agent.worktree).toBe('/work/other')
  })

  test('an ignored event changes nothing and reports no update', () => {
    const session = makeSession()
    expect(applyStreamEvent(session, { kind: 'ignored' }, 9)).toBe(false)
    expect(sessionToAgent(session)).toEqual(sessionToAgent(makeSession()))
  })
})
