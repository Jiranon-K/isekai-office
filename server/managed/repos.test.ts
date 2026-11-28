import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, parse, resolve } from 'node:path'
import { listLocalRepos, parseEnvRepos } from './repos'

let folder = ''

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'isekai-local-repos-'))
})

afterEach(() => {
  rmSync(folder, { recursive: true, force: true })
})

describe('parseEnvRepos and listLocalRepos', () => {
  test('splits comma and semicolon paths without breaking Windows drive colons', () => {
    expect(parseEnvRepos('D:\\Work\\App, C:\\Code\\Api; /srv/web')).toEqual(['D:\\Work\\App', 'C:\\Code\\Api', '/srv/web'])
    expect(parseEnvRepos(undefined)).toEqual([])
  })

  test('merges LOCAL_REPOS and transcript cwds, rejects unsafe or missing paths, and caps at 20', async () => {
    const home = join(folder, 'home')
    const projectsDir = join(folder, 'projects')
    const repoEnv = join(folder, 'repo-env')
    const repoTranscript = join(folder, 'repo-transcript')
    const notADir = join(folder, 'plain-file.txt')
    mkdirSync(home, { recursive: true })
    mkdirSync(join(projectsDir, 'p1'), { recursive: true })
    mkdirSync(repoEnv, { recursive: true })
    mkdirSync(repoTranscript, { recursive: true })
    writeFileSync(notADir, 'hi')
    writeFileSync(
      join(projectsDir, 'p1', 's1.jsonl'),
      `${JSON.stringify({ type: 'user', cwd: repoTranscript, message: { content: 'hi' } })}\n`
    )

    const root = parse(resolve(folder)).root
    const repos = await listLocalRepos({
      home,
      projectsDir,
      envRepos: [repoEnv, home, root, notADir, 'relative/dir', join(folder, 'missing'), repoEnv].join(';')
    })
    expect(repos).toEqual([
      { id: resolve(repoEnv), name: 'repo-env' },
      { id: resolve(repoTranscript), name: 'repo-transcript' }
    ])

    const manyDirs: string[] = []
    for (let index = 0; index < 25; index += 1) {
      const dir = join(folder, `many-${index}`)
      mkdirSync(dir, { recursive: true })
      manyDirs.push(dir)
    }
    const capped = await listLocalRepos({ home, projectsDir, envRepos: manyDirs.join(',') })
    expect(capped).toHaveLength(20)
  })
})
