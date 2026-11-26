import { describe, expect, test } from 'bun:test'
import { toCommand } from './command'
import { demoLog } from './feeds/demo'
import { isAllowedRequest } from './guard'
import { parseLoopState } from './sources/loop-state'
import { cleanTitle, lastTool, sendArgs, toState } from './sources/orca'
import { columnFor, parseRpcBody } from './sources/workspace'

const PORT = 4300
const DEV_SERVER_PORT = 4302
const PORTS = { serverPort: DEV_SERVER_PORT, publicPort: PORT }

function request(method: string, headers: Record<string, string>): Request {
  return new Request(`http://localhost:${PORT}/api/command`, { method, headers })
}

describe('guard', () => {
  test('a page on another site cannot post a command', () => {
    expect(isAllowedRequest(request('POST', { host: 'localhost:4300', origin: 'https://evil.example', 'content-type': 'application/json' }), PORTS)).toBe(false)
  })

  test('a form post without json is refused even from the app origin', () => {
    expect(isAllowedRequest(request('POST', { host: 'localhost:4300', origin: 'http://localhost:4300', 'content-type': 'text/plain' }), PORTS)).toBe(false)
  })

  test('a rebinding host is refused', () => {
    expect(isAllowedRequest(request('GET', { host: 'attacker.example:4300' }), PORTS)).toBe(false)
  })

  test('the public port and the server port are allowed, other ports are not', () => {
    expect(isAllowedRequest(request('POST', { host: 'localhost:4300', origin: 'http://localhost:4300', 'content-type': 'application/json' }), PORTS)).toBe(true)
    expect(isAllowedRequest(request('POST', { host: '127.0.0.1:4302', origin: 'http://127.0.0.1:4302', 'content-type': 'application/json' }), PORTS)).toBe(true)
    expect(isAllowedRequest(request('GET', { host: 'localhost:4301' }), PORTS)).toBe(false)
  })
})

describe('orca commands', () => {
  test('a prompt is pasted with enter and an empty prompt is not sent', () => {
    expect(sendArgs('term_1', { agentId: 'a', action: 'prompt', text: ' /jk-loop:start OPS-1 ' })).toEqual([
      'terminal', 'send', '--terminal', 'term_1', '--text', '/jk-loop:start OPS-1', '--enter', '--wait-submit', '5'
    ])
    expect(sendArgs('term_1', { agentId: 'a', action: 'prompt', text: '   ' })).toBeNull()
  })

  test('allow presses 1 and deny or stop press escape without enter', () => {
    expect(sendArgs('t', { agentId: 'a', action: 'allow' })).toEqual(['terminal', 'send', '--terminal', 't', '--text', '1'])
    expect(sendArgs('t', { agentId: 'a', action: 'deny' })).toEqual(['terminal', 'send', '--terminal', 't', '--text', '\x1b'])
    expect(sendArgs('t', { agentId: 'a', action: 'escape' })).toEqual(['terminal', 'send', '--terminal', 't', '--text', '\x1b'])
  })

  test('choose presses the digit of the choice without enter', () => {
    expect(sendArgs('t', { agentId: 'a', action: 'choose', choice: 3 })).toEqual(['terminal', 'send', '--terminal', 't', '--text', '3'])
  })

  test('choose without a choice is not sent', () => {
    expect(sendArgs('t', { agentId: 'a', action: 'choose' })).toBeNull()
  })

  test('a title made of a command caveat falls back to the workspace name', () => {
    expect(cleanTitle('<local-command-caveat>Caveat: the messages below</local-command-caveat>', 'main')).toBe('main')
    expect(cleanTitle('<command-name>/clear</command-name> Fix login', 'main')).toBe('Fix login')
    expect(cleanTitle('<local-command-caveat>Caveat: cut off mid', 'main')).toBe('main')
  })

  test('unknown states fall back to done and the newest tool wins', () => {
    expect(toState('sleeping')).toBe('done')
    expect(lastTool([{ tools: [{ name: 'Read' }] }, { tools: [{ name: 'Bash' }] }])).toBe('Bash')
    expect(lastTool([{ text: 'hi' }])).toBeNull()
  })
})

describe('board', () => {
  test('statuses land in the four columns and cancelled work is hidden', () => {
    expect(columnFor({ id: '1', name: 'Ready', category: 'backlog' }, false)).toBe('todo')
    expect(columnFor({ id: '2', name: 'In Progress', category: 'active' }, false)).toBe('doing')
    expect(columnFor({ id: '3', name: 'In Review', category: 'active', isReview: true }, false)).toBe('review')
    expect(columnFor({ id: '4', name: 'Verifying', category: 'active' }, false)).toBe('review')
    expect(columnFor({ id: '5', name: 'Done', category: 'done' }, false)).toBe('done')
    expect(columnFor({ id: '6', name: "Won't Do", category: 'done' }, false)).toBeNull()
    expect(columnFor({ id: '7', name: 'Cancelled', category: 'cancelled' }, false)).toBeNull()
  })

  test('mcp replies parse as json or as an event stream', () => {
    expect(parseRpcBody('{"result":{"content":[]}}')).toEqual({ result: { content: [] } })
    expect(parseRpcBody('event: message\ndata: {"result":{"isError":true}}\n\n')).toEqual({ result: { isError: true } })
  })

  test('loop-state lines become stages keyed by ticket', () => {
    const stages = parseLoopState('OPS-541 status=merged repo=web mr=https://x/1 ui=yes session=abc\nAPP-9 status=working repo=ui wt=/tmp/wt\n\n')
    expect(stages.get('OPS-541')).toEqual({ status: 'merged', mr: 'https://x/1', worktree: null, session: 'abc' })
    expect(stages.get('APP-9')).toEqual({ status: 'working', mr: null, worktree: '/tmp/wt', session: null })
  })
})

describe('command body', () => {
  test('choose with a choice from 1 to 9 is accepted', () => {
    expect(toCommand({ agentId: 'a', action: 'choose', choice: 1 })).toEqual({ agentId: 'a', action: 'choose', text: undefined, choice: 1 })
    expect(toCommand({ agentId: 'a', action: 'choose', choice: 9 })?.choice).toBe(9)
  })

  test('choose with 0, 10, 1.5, a string or nothing is refused', () => {
    for (const choice of [0, 10, 1.5, '2', null, undefined]) {
      expect(toCommand({ agentId: 'a', action: 'choose', choice })).toBeNull()
    }
  })

  test('the other actions ignore a choice', () => {
    expect(toCommand({ agentId: 'a', action: 'allow', choice: 99 })?.choice).toBeUndefined()
  })

  test('an unknown action or a missing agent is refused', () => {
    expect(toCommand({ agentId: 'a', action: 'explode' })).toBeNull()
    expect(toCommand({ action: 'allow' })).toBeNull()
    expect(toCommand(null)).toBeNull()
  })
})

describe('guild log', () => {
  test('the log body is a newest-first events list of about eight events', async () => {
    const { events } = await demoLog()
    const times = events.map((event) => event.at)
    expect(events).toHaveLength(8)
    expect(times).toEqual([...times].sort((first, second) => second - first))
    expect(Object.keys(events[0] ?? {}).sort()).toEqual(['agentId', 'at', 'from', 'title', 'to'])
  })
})
