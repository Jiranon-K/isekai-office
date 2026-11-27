import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readdir, readFile, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { OrderChange } from '@shared/orders'
import { changeLocalRule, localSettingsPath, readLayers, REAL_FILE_OPERATIONS, type SettingsFileOperations } from './permissions'

let folder = ''

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'isekai-orders-'))
})

afterEach(async () => {
  await rm(folder, { recursive: true, force: true })
})

function change(op: OrderChange['op'], rule: string, list: OrderChange['list'] = 'allow'): OrderChange {
  return { agentId: 'a', op, list, rule }
}

async function writeLocal(content: string): Promise<void> {
  await mkdir(join(folder, '.claude'), { recursive: true })
  await writeFile(localSettingsPath(folder), content)
}

async function readLocal(): Promise<string> {
  return readFile(localSettingsPath(folder), 'utf8')
}

describe('changing the local settings file', () => {
  test('a missing file is created holding only permissions', async () => {
    expect(await changeLocalRule(folder, change('add', 'Bash(bun test)'))).toEqual({ ok: true, error: null })
    expect(JSON.parse(await readLocal())).toEqual({ permissions: { allow: ['Bash(bun test)'] } })
  })

  test('a file without permissions gets the key and keeps everything else', async () => {
    await writeLocal(JSON.stringify({ model: 'opus', env: { A: '1' } }))
    await changeLocalRule(folder, change('add', 'Bash(bun test)'))
    expect(JSON.parse(await readLocal())).toEqual({ model: 'opus', env: { A: '1' }, permissions: { allow: ['Bash(bun test)'] } })
  })

  test('other keys and the other list are kept in meaning', async () => {
    const original = { model: 'opus', hooks: { Stop: [] }, permissions: { allow: ['Read'], deny: ['Bash(rm *)'], defaultMode: 'plan' } }
    await writeLocal(JSON.stringify(original))
    await changeLocalRule(folder, change('add', 'Bash(git status)'))
    await changeLocalRule(folder, change('add', 'WebFetch(domain:example.com)', 'deny'))
    expect(JSON.parse(await readLocal())).toEqual({
      model: 'opus',
      hooks: { Stop: [] },
      permissions: { allow: ['Read', 'Bash(git status)'], deny: ['Bash(rm *)', 'WebFetch(domain:example.com)'], defaultMode: 'plan' }
    })
  })

  test('a rule already present is not added twice and the file is not rewritten', async () => {
    const original = JSON.stringify({ permissions: { allow: ['Bash(bun test)'] } })
    await writeLocal(original)
    expect(await changeLocalRule(folder, change('add', 'Bash(bun test)'))).toEqual({ ok: true, error: null })
    expect(await readLocal()).toBe(original)
  })

  test('removing a rule drops only that rule', async () => {
    await writeLocal(JSON.stringify({ permissions: { allow: ['Read', 'Bash(bun test)'] } }))
    await changeLocalRule(folder, change('remove', 'Bash(bun test)'))
    expect(JSON.parse(await readLocal())).toEqual({ permissions: { allow: ['Read'] } })
  })

  test('removing an absent rule is ok and creates no file', async () => {
    expect(await changeLocalRule(folder, change('remove', 'Bash(bun test)'))).toEqual({ ok: true, error: null })
    expect(await readdir(folder)).toEqual([])
  })

  test('broken json is refused and left byte for byte alone', async () => {
    const broken = '{ "permissions": { "allow": ["Read"'
    await writeLocal(broken)
    expect(await changeLocalRule(folder, change('add', 'Bash(bun test)'))).toEqual({ ok: false, error: 'unparseable' })
    expect(await changeLocalRule(folder, change('remove', 'Read'))).toEqual({ ok: false, error: 'unparseable' })
    expect(await readLocal()).toBe(broken)
  })

  test('a document that is not an object or has a wrong permissions shape is left alone', async () => {
    for (const content of ['[]', '"text"', '{"permissions": []}', '{"permissions": {"allow": "Read"}}']) {
      await writeLocal(content)
      expect(await changeLocalRule(folder, change('add', 'Bash(bun test)'))).toEqual({ ok: false, error: 'unparseable' })
      expect(await readLocal()).toBe(content)
    }
  })

  test('a failing rename leaves the original intact and no temp file behind', async () => {
    const original = JSON.stringify({ permissions: { allow: ['Read'] } })
    await writeLocal(original)
    const failing: SettingsFileOperations = {
      ...REAL_FILE_OPERATIONS,
      rename: async () => {
        throw new Error('crash')
      }
    }
    expect(await changeLocalRule(folder, change('add', 'Bash(bun test)'), failing)).toEqual({ ok: false, error: 'write_failed' })
    expect(await readLocal()).toBe(original)
    expect(await readdir(join(folder, '.claude'))).toEqual(['settings.local.json'])
  })

  test('a relative worktree path is refused', async () => {
    expect(await changeLocalRule('relative/path', change('add', 'Bash(bun test)'))).toEqual({ ok: false, error: 'no_worktree' })
  })

  test('two changes at once both land', async () => {
    await Promise.all([changeLocalRule(folder, change('add', 'Read')), changeLocalRule(folder, change('add', 'Glob'))])
    expect(JSON.parse(await readLocal()).permissions.allow.sort()).toEqual(['Glob', 'Read'])
  })
})

describe('reading the layers', () => {
  test('three layers come back with their rules and a broken one reports an error', async () => {
    const home = join(folder, 'home')
    const worktree = join(folder, 'tree')
    await mkdir(join(home, '.claude'), { recursive: true })
    await mkdir(join(worktree, '.claude'), { recursive: true })
    await writeFile(join(home, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Read'], ask: ['Bash(git push *)'] } }))
    await writeFile(join(worktree, '.claude', 'settings.json'), '{ broken')
    await writeFile(join(worktree, '.claude', 'settings.local.json'), JSON.stringify({ permissions: { deny: ['Bash(rm *)'] } }))
    const layers = await readLayers(worktree, home)
    expect(layers.map((layer) => layer.scope)).toEqual(['user', 'project', 'local'])
    expect(layers[0]).toEqual({ scope: 'user', allow: ['Read'], deny: [], ask: ['Bash(git push *)'], error: null })
    expect(layers[1]).toEqual({ scope: 'project', allow: [], deny: [], ask: [], error: 'unparseable' })
    expect(layers[2]).toEqual({ scope: 'local', allow: [], deny: ['Bash(rm *)'], ask: [], error: null })
  })

  test('missing files are empty layers without an error and no worktree gives only the user layer filled', async () => {
    const layers = await readLayers(null, join(folder, 'nohome'))
    expect(layers).toHaveLength(3)
    expect(layers.every((layer) => layer.error === null && layer.allow.length === 0)).toBe(true)
  })
})
