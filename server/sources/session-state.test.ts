import { describe, expect, test } from 'bun:test'
import { stateFromTail, toolFromTail } from './session-state'

function assistant(blocks: unknown[], extra: Record<string, unknown> = {}, stopReason: string | null = null): string {
  return JSON.stringify({ type: 'assistant', message: { content: blocks, stop_reason: stopReason }, ...extra })
}

function user(content: unknown, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ type: 'user', message: { content }, ...extra })
}

const TEXT = { type: 'text', text: 'all done' }
const BASH = { type: 'tool_use', name: 'Bash', input: {} }
const READ = { type: 'tool_use', name: 'Read', input: {} }
const RESULT = { type: 'tool_result', tool_use_id: 'x', content: 'ok' }

describe('stateFromTail', () => {
  test('an assistant message with no tool call is done', () => {
    expect(stateFromTail([user('fix it'), assistant([TEXT], {}, 'end_turn')])).toBe('done')
  })

  test('an assistant message with a pending tool call is working', () => {
    expect(stateFromTail([user('fix it'), assistant([TEXT, BASH], {}, 'tool_use')])).toBe('working')
  })

  test('a tool result is working', () => {
    expect(stateFromTail([assistant([BASH]), user([RESULT])])).toBe('working')
  })

  test('a user prompt is working', () => {
    expect(stateFromTail([assistant([TEXT]), user('next thing')])).toBe('working')
  })

  test('a tool_use stop reason is working even when the block is in another line', () => {
    expect(stateFromTail([assistant([{ type: 'thinking' }], {}, 'tool_use')])).toBe('working')
  })

  test('an interrupted turn is done', () => {
    expect(stateFromTail([assistant([BASH]), user([{ type: 'text', text: '[Request interrupted by user]' }])])).toBe('done')
  })

  test('sidechain and meta lines are ignored', () => {
    const lines = [assistant([TEXT]), assistant([BASH], { isSidechain: true }), user('hidden', { isMeta: true })]
    expect(stateFromTail(lines)).toBe('done')
  })

  test('lines that are not conversation and broken lines are ignored', () => {
    const lines = [assistant([TEXT]), JSON.stringify({ type: 'last-prompt' }), '{"type":"user", broken', '']
    expect(stateFromTail(lines)).toBe('done')
  })

  test('a local slash command after a finished turn leaves it done', () => {
    const finished = [user('fix it'), assistant([TEXT], {}, 'end_turn')]
    for (const content of ['<command-name>/clear</command-name>', '<local-command-stdout>ok</local-command-stdout>', '<local-command-caveat>Caveat</local-command-caveat>']) {
      expect(stateFromTail([...finished, user(content)])).toBe('done')
      expect(stateFromTail([...finished, user([{ type: 'text', text: content }])])).toBe('done')
    }
  })

  test('an empty file is done', () => {
    expect(stateFromTail([])).toBe('done')
    expect(stateFromTail([''])).toBe('done')
  })
})

describe('toolFromTail', () => {
  test('the last tool call of the turn names the tool', () => {
    expect(toolFromTail([user('go'), assistant([READ]), user([RESULT]), assistant([BASH])])).toBe('Bash')
  })

  test('a tool result keeps the tool that just ran', () => {
    expect(toolFromTail([user('go'), assistant([READ]), user([RESULT])])).toBe('Read')
  })

  test('a new prompt clears the tool of the previous turn', () => {
    expect(toolFromTail([assistant([READ]), user([RESULT]), assistant([TEXT]), user('again')])).toBeNull()
  })

  test('no tool call gives null', () => {
    expect(toolFromTail([user('go'), assistant([TEXT])])).toBeNull()
  })
})
