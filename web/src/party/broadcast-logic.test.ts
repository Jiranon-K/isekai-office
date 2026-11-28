import { describe, expect, test } from 'bun:test'
import type { OfficeAgent } from '@shared/types'
import { canSendBroadcast, claimSubmit, describeRow, GONE_REASON, initialRows, releaseSubmit, runBroadcast, textAfterRun, UNREACHABLE_REASON, type BroadcastDeps } from './broadcast-logic'
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
    stateSince: 0,
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
    report: (rows) => snapshots.push(rows),
    isCancelled: () => false
  }
  return { live, sent, snapshots, deps }
}

describe('submit guard', () => {
  test('the second claim before the first is released is refused', () => {
    const guard = { current: false }
    expect(claimSubmit(guard)).toBe(true)
    expect(claimSubmit(guard)).toBe(false)
  })

  test('a released guard can be claimed again', () => {
    const guard = { current: false }
    claimSubmit(guard)
    releaseSubmit(guard)
    expect(claimSubmit(guard)).toBe(true)
  })
})

describe('canSendBroadcast', () => {
  const ready = { commandAllowed: true, running: false, chosenCount: 2, text: 'hello' }

  test('allows a ready composer', () => {
    expect(canSendBroadcast(ready)).toBe(true)
  })

  test('refuses on a read-only source', () => {
    expect(canSendBroadcast({ ...ready, commandAllowed: false })).toBe(false)
  })

  test('refuses while running, with nobody chosen or with blank text', () => {
    expect(canSendBroadcast({ ...ready, running: true })).toBe(false)
    expect(canSendBroadcast({ ...ready, chosenCount: 0 })).toBe(false)
    expect(canSendBroadcast({ ...ready, text: '   ' })).toBe(false)
  })
})

describe('textAfterRun', () => {
  const sent: BroadcastRow = { agentId: 'a', status: 'sent', reason: null }

  test('clears the text when every row was sent', () => {
    expect(textAfterRun('hello', [sent, { ...sent, agentId: 'b' }])).toBe('')
  })

  test('keeps the text when a row failed so it can be retried', () => {
    expect(textAfterRun('hello', [sent, { agentId: 'b', status: 'failed', reason: 'x' }])).toBe('hello')
  })

  test('keeps the text when a row was skipped', () => {
    expect(textAfterRun('hello', [sent, { agentId: 'b', status: 'skipped', reason: 'x' }])).toBe('hello')
  })

  test('keeps the text when there were no rows', () => {
    expect(textAfterRun('hello', [])).toBe('hello')
  })
})

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

  test('stops sending to the remaining members once cancelled', async () => {
    const { sent, snapshots, deps } = setup([agent('a'), agent('b'), agent('c')])
    let cancelled = false
    const originalSend = deps.send
    deps.send = async (agentId, text) => {
      cancelled = true
      return originalSend(agentId, text)
    }
    deps.isCancelled = () => cancelled
    const snapshotsAtCancel = snapshots.length
    await runBroadcast(['a', 'b', 'c'], 'hello', deps)
    expect(sent).toEqual(['a'])
    const afterCancel = snapshots.slice(snapshotsAtCancel).filter((rows) => rows.some((row) => row.agentId === 'b' && row.status !== 'idle'))
    expect(afterCancel).toEqual([])
  })

  test('a broadcast cancelled before it starts sends nothing and reports nothing', async () => {
    const { sent, snapshots, deps } = setup([agent('a'), agent('b')])
    deps.isCancelled = () => true
    await runBroadcast(['a', 'b'], 'hello', deps)
    expect(sent).toEqual([])
    expect(snapshots).toEqual([])
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

describe('describeRow', () => {
  test('reads each status in Thai and shows the reason for a skip or a failure', () => {
    expect(describeRow({ agentId: 'a', status: 'idle', reason: null })).toBeNull()
    expect(describeRow({ agentId: 'a', status: 'sending', reason: null })).toBe('กำลังส่ง')
    expect(describeRow({ agentId: 'a', status: 'sent', reason: null })).toBe('ส่งแล้ว')
    expect(describeRow({ agentId: 'a', status: 'failed', reason: 'no_terminal' })).toBe('ส่งไม่สำเร็จ (no_terminal)')
    expect(describeRow({ agentId: 'a', status: 'skipped', reason: SKIP_REASONS.working })).toBe('กำลังทำงานอยู่')
  })
})
