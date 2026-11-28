import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, parse, resolve } from 'node:path'
import { buildAgentDiff, MAX_DIFF_FILES, parseNumstat, parsePorcelainStatus, readGitDiff, type GitRunner } from './git'

let tempRoot = ''

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'isekai-diff-'))
})

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true })
})

function gitSync(cwd: string, args: string[]): void {
  const result = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr))
  }
}

describe('parsePorcelainStatus', () => {
  test('parses branch header and all file statuses including renames and CRLF', () => {
    const output = [
      '## feat/dark-mode...origin/feat/dark-mode [ahead 2]',
      ' M web/src/app.ts',
      'A  web/src/new.ts',
      ' D web/src/old.ts',
      'R  web/src/before.ts -> web/src/after.ts',
      '?? web/src/draft.ts',
      '!! ignored.log'
    ].join('\r\n')
    const parsed = parsePorcelainStatus(output)
    expect(parsed.branch).toBe('feat/dark-mode')
    expect(parsed.entries).toEqual([
      { path: 'web/src/app.ts', status: 'modified' },
      { path: 'web/src/new.ts', status: 'added' },
      { path: 'web/src/old.ts', status: 'deleted' },
      { path: 'web/src/after.ts', status: 'renamed' },
      { path: 'web/src/draft.ts', status: 'untracked' }
    ])
  })

  test('handles unborn branch and detached HEAD headers', () => {
    expect(parsePorcelainStatus('## No commits yet on main\n').branch).toBe('main')
    expect(parsePorcelainStatus('## Initial commit on develop\n').branch).toBe('develop')
    expect(parsePorcelainStatus('## HEAD (no branch)\n').branch).toBeNull()
  })
})

describe('parseNumstat and buildAgentDiff', () => {
  test('merges staged and unstaged counts, handles binary files and brace renames', () => {
    const status = [
      '## feat/merge-test',
      'MM src/app.ts',
      'R  src/old.ts -> src/new.ts',
      'M  assets/logo.png',
      '?? notes.md'
    ].join('\n')
    const unstaged = ['5\t2\tsrc/app.ts', '-\t-\tassets/logo.png'].join('\n')
    const cached = ['10\t3\tsrc/app.ts', '4\t1\tsrc/{old.ts => new.ts}'].join('\n')
    const diff = buildAgentDiff('a1', status, unstaged, cached)
    expect(diff).toEqual({
      agentId: 'a1',
      branch: 'feat/merge-test',
      files: [
        { path: 'src/app.ts', status: 'modified', added: 15, removed: 5 },
        { path: 'src/new.ts', status: 'renamed', added: 4, removed: 1 },
        { path: 'assets/logo.png', status: 'modified', added: 0, removed: 0 },
        { path: 'notes.md', status: 'untracked', added: 0, removed: 0 }
      ],
      totalAdded: 19,
      totalRemoved: 6,
      truncated: false,
      error: null
    })
  })

  test('normalizes top-level rename paths in numstat', () => {
    const counts = parseNumstat('7\t2\told.ts => new.ts\n')
    expect(counts.get('new.ts')).toEqual({ added: 7, removed: 2 })
  })

  test('truncates file list at 100 files while keeping total line counts', () => {
    const totalCount = MAX_DIFF_FILES + 12
    const statusLines = ['## main', ...Array.from({ length: totalCount }, (_, index) => ` M file-${index}.ts`)]
    const numstatLines = Array.from({ length: totalCount }, (_, index) => `2\t1\tfile-${index}.ts`)
    const diff = buildAgentDiff('a1', statusLines.join('\n'), numstatLines.join('\n'), '')
    expect(diff.files).toHaveLength(MAX_DIFF_FILES)
    expect(diff.truncated).toBe(true)
    expect(diff.totalAdded).toBe(totalCount * 2)
    expect(diff.totalRemoved).toBe(totalCount)
    expect(diff.error).toBeNull()
  })
})

describe('readGitDiff', () => {
  test('rejects home directory, filesystem root, and relative paths with not_a_repo without invoking git', async () => {
    let called = false
    const spyRunner: GitRunner = async () => {
      called = true
      return { ok: true, stdout: '' }
    }
    const home = join(tempRoot, 'home')
    const root = parse(resolve(tempRoot)).root
    const homeDiff = await readGitDiff('a1', home, { home, runGit: spyRunner })
    const rootDiff = await readGitDiff('a1', root, { home, runGit: spyRunner })
    const relativeDiff = await readGitDiff('a1', 'relative/repo', { home, runGit: spyRunner })
    expect(homeDiff.error).toBe('not_a_repo')
    expect(rootDiff.error).toBe('not_a_repo')
    expect(relativeDiff.error).toBe('not_a_repo')
    expect(called).toBe(false)
  })

  test('returns git_unavailable when any git command fails', async () => {
    const failingRunner: GitRunner = async (args) => ({ ok: args[0] !== 'diff', stdout: '## main\n' })
    const diff = await readGitDiff('a1', join(tempRoot, 'repo'), { home: join(tempRoot, 'home'), runGit: failingRunner })
    expect(diff.error).toBe('git_unavailable')
    expect(diff.files).toEqual([])
  })

  test('returns git_unavailable for a non-git directory', async () => {
    const diff = await readGitDiff('a1', tempRoot, { home: join(tempRoot, 'different-home') })
    expect(diff.error).toBe('git_unavailable')
  })

  test('reads real git status and staged plus unstaged numstat from a repository', async () => {
    gitSync(tempRoot, ['init', '-b', 'feat/live-test'])
    gitSync(tempRoot, ['config', 'user.email', 'test@example.com'])
    gitSync(tempRoot, ['config', 'user.name', 'Test User'])
    writeFileSync(join(tempRoot, 'keep.txt'), 'line1\nline2\n')
    writeFileSync(join(tempRoot, 'remove.txt'), 'bye\n')
    gitSync(tempRoot, ['add', '.'])
    gitSync(tempRoot, ['commit', '-m', 'init'])
    writeFileSync(join(tempRoot, 'keep.txt'), 'line1\nline2-staged\nline3-staged\n')
    gitSync(tempRoot, ['add', 'keep.txt'])
    writeFileSync(join(tempRoot, 'keep.txt'), 'line1\nline2-staged\nline3-staged\nline4-unstaged\n')
    writeFileSync(join(tempRoot, 'added.txt'), 'hello\nworld\n')
    gitSync(tempRoot, ['add', 'added.txt'])
    unlinkSync(join(tempRoot, 'remove.txt'))
    writeFileSync(join(tempRoot, 'untracked.txt'), 'draft\n')

    const diff = await readGitDiff('a1', tempRoot, { home: join(tempRoot, 'different-home') })
    expect(diff.error).toBeNull()
    expect(diff.branch).toBe('feat/live-test')
    expect(diff.truncated).toBe(false)
    const byPath = new Map(diff.files.map((file) => [file.path, file]))
    expect(byPath.get('keep.txt')).toEqual({ path: 'keep.txt', status: 'modified', added: 3, removed: 1 })
    expect(byPath.get('added.txt')).toEqual({ path: 'added.txt', status: 'added', added: 2, removed: 0 })
    expect(byPath.get('remove.txt')).toEqual({ path: 'remove.txt', status: 'deleted', added: 0, removed: 1 })
    expect(byPath.get('untracked.txt')).toEqual({ path: 'untracked.txt', status: 'untracked', added: 0, removed: 0 })
    expect(diff.totalAdded).toBe(5)
    expect(diff.totalRemoved).toBe(2)
  })
})
