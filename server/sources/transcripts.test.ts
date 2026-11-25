import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { contextWindowFrom } from '../feeds/office'
import { worktreeFromId } from './orca'
import { parseTranscriptTail, pickTranscript, sessionContext, transcriptFolder } from './transcripts'

const NOW = 1_800_000_000_000
const HOUR_MS = 60 * 60 * 1000

function assistantLine(input: number, created: number, read: number): string {
  return JSON.stringify({
    type: 'assistant',
    message: { usage: { input_tokens: input, cache_creation_input_tokens: created, cache_read_input_tokens: read, output_tokens: 9 } }
  })
}

function titleLine(title: string): string {
  return JSON.stringify({ type: 'ai-title', aiTitle: title })
}

describe('transcript folder', () => {
  test('slashes and dots in the worktree path become dashes', () => {
    expect(transcriptFolder('/Users/a.b/Home/.claude/worktrees/x').endsWith('-Users-a-b-Home--claude-worktrees-x')).toBe(true)
  })
})

describe('transcript tail', () => {
  test('context is the three input fields of the last assistant line and the title is the last ai-title', () => {
    const text = [
      titleLine('First'),
      assistantLine(1, 2, 3),
      JSON.stringify({ type: 'user', message: { content: 'hello' } }),
      titleLine('Second'),
      assistantLine(2, 8517, 133969),
      JSON.stringify({ type: 'user', message: { content: 'next' } })
    ].join('\n')
    expect(parseTranscriptTail(text)).toEqual({ title: 'Second', contextTokens: 142488 })
  })

  test('a tail with no usage or title gives nulls and a broken first line is ignored', () => {
    expect(parseTranscriptTail('{"type":"assi\n' + JSON.stringify({ type: 'user' }))).toEqual({ title: null, contextTokens: null })
  })

  test('an assistant line without usage does not hide an earlier one', () => {
    const text = [assistantLine(1, 1, 1), JSON.stringify({ type: 'assistant', message: {} })].join('\n')
    expect(parseTranscriptTail(text).contextTokens).toBe(3)
  })
})

describe('pickTranscript', () => {
  const recent = NOW - HOUR_MS

  test('the candidate whose title matches wins over a newer one', () => {
    const picked = pickTranscript(
      [
        { path: '/a.jsonl', title: 'Other', modifiedAt: NOW },
        { path: '/b.jsonl', title: 'Mine', modifiedAt: recent }
      ],
      'Mine',
      NOW
    )
    expect(picked).toBe('/b.jsonl')
  })

  test('with no title match a single recent candidate is taken', () => {
    const candidates = [
      { path: '/a.jsonl', title: null, modifiedAt: recent },
      { path: '/old.jsonl', title: null, modifiedAt: NOW - 48 * HOUR_MS }
    ]
    expect(pickTranscript(candidates, 'Mine', NOW)).toBe('/a.jsonl')
  })

  test('with no title match and several candidates nothing is picked', () => {
    const candidates = [
      { path: '/a.jsonl', title: 'A', modifiedAt: recent },
      { path: '/b.jsonl', title: 'B', modifiedAt: recent }
    ]
    expect(pickTranscript(candidates, 'Mine', NOW)).toBeNull()
  })

  test('a title match older than a day is ignored', () => {
    expect(pickTranscript([{ path: '/a.jsonl', title: 'Mine', modifiedAt: NOW - 48 * HOUR_MS }], 'Mine', NOW)).toBeNull()
  })
})

describe('sessionContext', () => {
  let projectsDir = ''
  let worktreeCount = 0

  beforeAll(async () => {
    projectsDir = await mkdtemp(join(tmpdir(), 'isekai-transcripts-'))
  })

  afterAll(async () => {
    await rm(projectsDir, { recursive: true, force: true })
  })

  async function worktreeWith(files: Record<string, string>): Promise<string> {
    worktreeCount += 1
    const worktree = `/work/tree-${worktreeCount}`
    const folder = transcriptFolder(worktree, projectsDir)
    await mkdir(folder, { recursive: true })
    await Promise.all(Object.entries(files).map(([name, text]) => writeFile(join(folder, name), text)))
    return worktree
  }

  test('the session and context of the transcript with the matching title are returned', async () => {
    const worktree = await worktreeWith({
      'aaa.jsonl': [titleLine('Other'), assistantLine(1, 1, 1)].join('\n'),
      'bbb.jsonl': [titleLine('Mine'), assistantLine(10, 20, 30)].join('\n')
    })
    expect(await sessionContext(worktree, 'Mine', projectsDir)).toEqual({ session: 'bbb', contextTokens: 60 })
  })

  test('a changed transcript is read again', async () => {
    const worktree = await worktreeWith({ 'ccc.jsonl': [titleLine('Mine'), assistantLine(1, 1, 1)].join('\n') })
    await sessionContext(worktree, 'Mine', projectsDir)
    const grown = [titleLine('Mine'), assistantLine(1, 1, 1), assistantLine(5, 5, 5)].join('\n')
    await writeFile(join(transcriptFolder(worktree, projectsDir), 'ccc.jsonl'), grown)
    expect((await sessionContext(worktree, 'Mine', projectsDir))?.contextTokens).toBe(15)
  })

  test('a worktree with no transcript folder gives null', async () => {
    expect(await sessionContext('/nonexistent/worktree/path', 'Mine', projectsDir)).toBeNull()
  })
})

describe('orca worktree id', () => {
  test('the path after the double colon is the worktree', () => {
    expect(worktreeFromId('fabd67d5-510a::/Users/me/Home')).toBe('/Users/me/Home')
  })

  test('a folder id without a path gives null', () => {
    expect(worktreeFromId('folder:6cd3011d')).toBeNull()
    expect(worktreeFromId(undefined)).toBeNull()
  })
})

describe('context window setting', () => {
  test('a valid number is used and anything else falls back to one million', () => {
    expect(contextWindowFrom('200000')).toBe(200000)
    expect(contextWindowFrom(undefined)).toBe(1_000_000)
    expect(contextWindowFrom('abc')).toBe(1_000_000)
    expect(contextWindowFrom('0')).toBe(1_000_000)
  })
})
