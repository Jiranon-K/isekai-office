import { describe, expect, test } from 'bun:test'
import type { OfficeAgent } from '@shared/types'
import { GONE_REASON, initialRows, runBroadcast, UNREACHABLE_REASON, type BroadcastDeps } from './broadcast-logic'
import { SKIP_REASONS, type BroadcastRow } from './party-logic'

function agent(id: string, state: OfficeAgent['state'] = 'done'): OfficeAgent {
  return {
    id,
    title: `session ${id}`,
    repo: 'web',
    workspace: null,
    worktree: null,
    session: null,
    contextTokens: null,
    state,
    tool: null,
    lastMessage: null,
    updatedAt: 0,
    activeAt: 0,
    terminal: `t-${id}`
  }
}

type Setup = { live: Map<string, OfficeAgent>; sent: string[]; snapshots: BroadcastRow[][]; deps: BroadcastDeps }

function setup(agents: OfficeAgent[], failures: Record<string, string | Error> = {}): Setup {
  const live = new Map(agents.map((member) => [member.id, member]))
  const sent: string[] = []
  const snapshots: BroadcastRow[][] = []
  const deps: BroadcastDeps = {
    latest: (agentId) => live.get(agentId) ?? null,
    send: async (agentId) => {
      const failure = failures[agentId]
      if (failure instanceof Error) {
        throw failure
      }
      if (failure) {
        return failure
      }
      sent.push(agentId)
      return null
    },
    report: (rows) => snapshots.push(rows)
  }
  return { live, sent, snapshots, deps }
}

describe('runBroadcast', () => {
  test('sends exactly the ready members and shows why another was skipped', async () => {
    const { sent, deps } = setup([agent('a'), agent('b', 'working'), agent('c')])
    const rows = await runBroadcast(['a', 'b', 'c'], 'rebase on main', deps)
    expect(sent).toEqual(['a', 'c'])
    expect(rows).toEqual([
      { agentId: 'a', status: 'sent', reason: null },
      { agentId: 'b', status: 'skipped', reason: SKIP_REASONS.working },
      { agentId: 'c', status: 'sent', reason: null }
    ])
  })

  test('a member that turns working between the click and its turn is skipped, not sent to', async () => {
    const { live, sent, deps } = setup([agent('a'), agent('b')])
    const originalSend = deps.send
    deps.send = async (agentId, text) => {
      live.set('b', agent('b', 'working'))
      return originalSend(agentId, text)
    }
    const rows = await runBroadcast(['a', 'b'], 'hello', deps)
    expect(sent).toEqual(['a'])
    expect(rows[1]).toEqual({ agentId: 'b', status: 'skipped', reason: SKIP_REASONS.working })
  })

  test('a member that left the room is skipped', async () => {
    const { live, sent, deps } = setup([agent('a'), agent('b')])
    live.delete('a')
    const rows = await runBroadcast(['a', 'b'], 'hello', deps)
    expect(sent).toEqual(['b'])
    expect(rows[0]).toEqual({ agentId: 'a', status: 'skipped', reason: GONE_REASON })
  })

  test('one failed send leaves the others sent and marks its own row', async () => {
    const { sent, deps } = setup([agent('a'), agent('b'), agent('c')], { b: 'no_terminal' })
    const rows = await runBroadcast(['a', 'b', 'c'], 'hello', deps)
    expect(sent).toEqual(['a', 'c'])
    expect(rows.map((row) => row.status)).toEqual(['sent', 'failed', 'sent'])
    expect(rows[1]?.reason).toBe('no_terminal')
  })

  test('a thrown send is a failure on its row and the run continues', async () => {
    const { sent, deps } = setup([agent('a'), agent('b')], { a: new Error('down') })
    const rows = await runBroadcast(['a', 'b'], 'hello', deps)
    expect(sent).toEqual(['b'])
    expect(rows[0]).toEqual({ agentId: 'a', status: 'failed', reason: UNREACHABLE_REASON })
  })

  test('sends one at a time and reports each step', async () => {
    const { snapshots, deps } = setup([agent('a'), agent('b')])
    await runBroadcast(['a', 'b'], 'hello', deps)
    expect(snapshots[0]).toEqual(initialRows(['a', 'b']))
    expect(snapshots.some((rows) => rows[0]?.status === 'sending' && rows[1]?.status === 'idle')).toBe(true)
    expect(snapshots.at(-1)?.map((row) => row.status)).toEqual(['sent', 'sent'])
  })
})
