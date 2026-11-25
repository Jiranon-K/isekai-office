import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mergeToolRuns, parseHistory, sessionHistory } from '../server/history'
import { transcriptFolder } from '../server/transcripts'

const AT = '2026-11-25T03:00:00.000Z'

function userLine(content: unknown, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ type: 'user', timestamp: AT, message: { role: 'user', content }, ...extra })
}

function assistantLine(content: unknown, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ type: 'assistant', timestamp: AT, message: { role: 'assistant', content }, ...extra })
}

function toolUse(name: string): { type: string; name: string } {
  return { type: 'tool_use', name }
}

describe('chat history', () => {
  test('keeps what the owner typed and what the agent said, with the time', () => {
    const history = parseHistory([userLine('commit it'), assistantLine([{ type: 'text', text: 'Done.' }])].join('\n'))
    expect(history).toEqual([
      { role: 'user', text: 'commit it', tools: [], at: Date.parse(AT) },
      { role: 'assistant', text: 'Done.', tools: [], at: Date.parse(AT) }
    ])
  })

  test('drops tool results, thinking, harness lines and the compact summary', () => {
    const lines = [
      userLine([{ type: 'tool_result', content: 'ok' }]),
      assistantLine([{ type: 'thinking', thinking: 'hmm' }]),
      userLine('<command-name>/compact</command-name>'),
      userLine('<local-command-stdout>Compacted</local-command-stdout>'),
      userLine('This session is being continued', { isCompactSummary: true }),
      userLine([{ type: 'text', text: 'skill body' }], { isMeta: true }),
      assistantLine([{ type: 'text', text: 'from a subagent' }], { isSidechain: true }),
      JSON.stringify({ type: 'ai-title', aiTitle: 'a title' }),
      'not json'
    ]
    expect(parseHistory(lines.join('\n'))).toEqual([])
  })

  test('shows pasted text without its wrapper tags', () => {
    const [entry] = parseHistory(userLine('\n\n<pasted_content id="2f40">\nthe spec\n</pasted_content>\ndo this'))
    expect(entry?.text).toBe('the spec\n\ndo this')
  })

  test('folds a run of tool calls into one entry', () => {
    const lines = [
      assistantLine([{ type: 'text', text: 'Looking.' }, toolUse('Read')]),
      assistantLine([toolUse('Bash')]),
      assistantLine([toolUse('Bash')]),
      assistantLine([toolUse('Edit')]),
      assistantLine([{ type: 'text', text: 'Fixed.' }])
    ]
    expect(parseHistory(lines.join('\n')).map((entry) => [entry.text, entry.tools])).toEqual([
      ['Looking.', ['Read']],
      ['', ['Bash', 'Bash', 'Edit']],
      ['Fixed.', []]
    ])
  })

  test('a tool run does not swallow a message from the owner', () => {
    const run = { role: 'assistant', text: '', tools: ['Bash'], at: null }
    const owner = { role: 'user', text: 'wait', tools: [], at: null }
    expect(mergeToolRuns([run, owner, run])).toHaveLength(3)
  })

  test('returns only the newest entries past the limit', () => {
    const lines = Array.from({ length: 5 }, (_, index) => userLine(`message ${index}`))
    expect(parseHistory(lines.join('\n'), 2).map((entry) => entry.text)).toEqual(['message 3', 'message 4'])
  })
})

describe('session history file', () => {
  let projectsDir = ''
  const worktree = '/Users/someone/repo'

  beforeAll(async () => {
    projectsDir = await mkdtemp(join(tmpdir(), 'isekai-history-'))
    const folder = transcriptFolder(worktree, projectsDir)
    await mkdir(folder, { recursive: true })
    await writeFile(join(folder, 'abc.jsonl'), [userLine('hello'), assistantLine([{ type: 'text', text: 'hi' }])].join('\n'))
  })

  afterAll(async () => {
    await rm(projectsDir, { recursive: true, force: true })
  })

  test('reads the transcript of the named session', async () => {
    const history = await sessionHistory(worktree, 'abc', projectsDir)
    expect(history?.map((entry) => entry.text)).toEqual(['hello', 'hi'])
  })

  test('is null when the session has no transcript file', async () => {
    expect(await sessionHistory(worktree, 'missing', projectsDir)).toBeNull()
  })
})
