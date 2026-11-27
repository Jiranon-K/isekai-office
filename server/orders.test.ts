import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, parse } from 'node:path'
import type { OrderChange } from '@shared/orders'
import type { OfficeAgent } from '@shared/types'
import { demoOrdersFeeds } from './feeds/demo-orders'
import { changeOrders, ordersFeedsFor, readOrders, realOrdersFeeds, type OrdersFeeds } from './orders'
import { localSettingsPath } from './sources/permissions'

function agentWith(worktree: string | null): OfficeAgent {
  return {
    id: 'a1', title: 't', repo: null, workspace: null, worktree, session: null, contextTokens: null,
    state: 'working', tool: null, lastMessage: null, updatedAt: 0, activeAt: 0, terminal: null
  }
}

function recordingFeeds(): { feeds: OrdersFeeds; changes: OrderChange[] } {
  const changes: OrderChange[] = []
  const feeds: OrdersFeeds = {
    read: demoOrdersFeeds.read,
    async change(_agent, change) {
      changes.push(change)
      return { ok: true, error: null }
    }
  }
  return { feeds, changes }
}

const knownAgent = (id: string): OfficeAgent | null => (id === 'a1' ? agentWith(null) : null)

function post(overrides: Record<string, unknown>): unknown {
  return { agentId: 'a1', op: 'add', list: 'allow', rule: 'Bash(bun test)', ...overrides }
}

describe('reading orders', () => {
  test('a known agent gets its three layers and the writable flag', async () => {
    const reply = await readOrders('a1', knownAgent, demoOrdersFeeds)
    expect(reply.status).toBe(200)
    expect(reply.body).toMatchObject({ agentId: 'a1', writable: true })
    expect(Reflect.get(reply.body, 'layers')).toHaveLength(3)
  })

  test('an agent that is not in the snapshot is 404', async () => {
    expect(await readOrders('ghost', knownAgent, demoOrdersFeeds)).toEqual({ status: 404, body: { ok: false, error: 'not_found' } })
  })
})

describe('changing orders', () => {
  test('a valid rule reaches the feed once, with the cleaned rule', async () => {
    const { feeds, changes } = recordingFeeds()
    const reply = await changeOrders(post({ rule: ' Bash(bun test) ' }), knownAgent, feeds)
    expect(reply).toEqual({ status: 200, body: { ok: true, error: null } })
    expect(changes).toEqual([{ agentId: 'a1', op: 'add', list: 'allow', rule: 'Bash(bun test)' }])
  })

  test('every too broad allow rule is 400 too_broad and reaches nothing', async () => {
    const { feeds, changes } = recordingFeeds()
    const rules = ['Bash', 'Write', 'Edit', 'Bash(*)', 'Bash(rm -rf *)', 'Bash(sudo ls)', 'Bash(git push *)', 'Bash(curl *)', 'Bash(powershell *)']
    for (const rule of rules) {
      expect(await changeOrders(post({ rule }), knownAgent, feeds)).toEqual({ status: 400, body: { ok: false, error: 'too_broad' } })
    }
    expect(changes).toEqual([])
  })

  test('a broad rule is accepted in deny', async () => {
    const { feeds, changes } = recordingFeeds()
    const reply = await changeOrders(post({ list: 'deny', rule: 'Bash(rm *)' }), knownAgent, feeds)
    expect(reply.status).toBe(200)
    expect(changes).toHaveLength(1)
  })

  test('a newline, a rule over 200 characters and an unknown tool are 400', async () => {
    const { feeds, changes } = recordingFeeds()
    for (const rule of ['Bash(ls\nrm)', `Bash(${'a'.repeat(200)})`, 'Nope(x)']) {
      expect((await changeOrders(post({ rule }), knownAgent, feeds)).status).toBe(400)
    }
    expect(changes).toEqual([])
  })

  test('a malformed body is 400 bad_request', async () => {
    const { feeds } = recordingFeeds()
    for (const body of [null, 'x', {}, post({ op: 'drop' }), post({ list: 'ask' }), post({ rule: 5 }), post({ agentId: 1 })]) {
      expect(await changeOrders(body, knownAgent, feeds)).toEqual({ status: 400, body: { ok: false, error: 'bad_request' } })
    }
  })

  test('an unknown agent is 404 and a path in the body is ignored', async () => {
    const { feeds, changes } = recordingFeeds()
    expect((await changeOrders(post({ agentId: 'ghost' }), knownAgent, feeds)).status).toBe(404)
    await changeOrders(post({ path: 'C:/elsewhere', worktree: 'C:/elsewhere' }), knownAgent, feeds)
    expect(Object.keys(changes[0] ?? {}).sort()).toEqual(['agentId', 'list', 'op', 'rule'])
  })

  test('removing keeps the rule exactly as written', async () => {
    const { feeds, changes } = recordingFeeds()
    await changeOrders(post({ op: 'remove', rule: 'Bash(rm -rf *)' }), knownAgent, feeds)
    expect(changes[0]?.rule).toBe('Bash(rm -rf *)')
  })

  test('a feed failure maps to a status', async () => {
    const failing: OrdersFeeds = { read: demoOrdersFeeds.read, change: async () => ({ ok: false, error: 'unparseable' }) }
    expect((await changeOrders(post({}), knownAgent, failing)).status).toBe(409)
  })
})

describe('the real feed against a temp worktree', () => {
  let worktree = ''

  beforeEach(async () => {
    worktree = await mkdtemp(join(tmpdir(), 'isekai-orders-route-'))
  })

  afterEach(async () => {
    await rm(worktree, { recursive: true, force: true })
  })

  test('an add lands in settings.local.json of the agent worktree only', async () => {
    const reply = await changeOrders(post({}), () => agentWith(worktree), realOrdersFeeds)
    expect(reply.status).toBe(200)
    expect(JSON.parse(await readFile(localSettingsPath(worktree), 'utf8'))).toEqual({ permissions: { allow: ['Bash(bun test)'] } })
    expect(await readdir(join(worktree, '.claude'))).toEqual(['settings.local.json'])
  })

  test('an agent without a worktree cannot be changed', async () => {
    const reply = await changeOrders(post({}), () => agentWith(null), realOrdersFeeds)
    expect(reply).toEqual({ status: 409, body: { ok: false, error: 'no_worktree' } })
  })
})

describe('a worktree that is the home folder or a filesystem root', () => {
  let home = ''

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'isekai-orders-home-'))
    await mkdir(join(home, '.claude'))
    await writeFile(join(home, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Read'] } }))
  })

  afterEach(async () => {
    await rm(home, { recursive: true, force: true })
  })

  test('the project layer is not shown a second time and the agent is not writable', async () => {
    const view = await ordersFeedsFor(home).read(agentWith(home))
    expect(view.writable).toBe(false)
    expect(view.layers.map((layer) => [layer.scope, layer.allow])).toEqual([['user', ['Read']], ['project', []], ['local', []]])
  })

  test('a normal worktree stays writable and keeps its project layer', async () => {
    const worktree = join(home, 'tree')
    await mkdir(join(worktree, '.claude'), { recursive: true })
    await writeFile(join(worktree, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Glob'] } }))
    const view = await ordersFeedsFor(home).read(agentWith(worktree))
    expect(view.writable).toBe(true)
    expect(view.layers[1]?.allow).toEqual(['Glob'])
  })

  test('a filesystem root is not writable', async () => {
    const view = await ordersFeedsFor(home).read(agentWith(parse(home).root))
    expect(view.writable).toBe(false)
  })

  test('a change aimed at the home folder is refused and writes nothing', async () => {
    const reply = await changeOrders(post({}), () => agentWith(home), ordersFeedsFor(home))
    expect(reply).toEqual({ status: 409, body: { ok: false, error: 'no_worktree' } })
    expect(await readdir(join(home, '.claude'))).toEqual(['settings.json'])
  })
})
