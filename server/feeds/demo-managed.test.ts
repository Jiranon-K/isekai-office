import { beforeEach, describe, expect, test } from 'bun:test'
import type { OfficeSnapshot } from '@shared/types'
import { handleSpawn } from '../spawn'
import { demoCommand, demoRepos, demoSession, demoSnapshot, demoSpawn, demoSubscribe, resetDemoState } from './demo'

beforeEach(() => {
  resetDemoState()
})

describe('interactive demo managed sessions', () => {
  test('demoSpawn adds waiting managed agent, notifies SSE subscribers, and demoCommand mutates state', async () => {
    const snapshots: OfficeSnapshot[] = []
    const unsubscribe = demoSubscribe((snapshot) => snapshots.push(snapshot))
    try {
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0]?.managedCount).toBe(0)
      expect(snapshots[0]?.managedCap).toBe(4)

      const reply = await handleSpawn(
        { repoId: 'demo-repo-1', name: 'fix-login', prompt: 'check auth' },
        { repos: demoRepos, spawn: demoSpawn }
      )
      expect(reply).toEqual({ status: 200, result: { ok: true, error: null } })
      expect(snapshots).toHaveLength(2)
      const latest = snapshots.at(-1)
      expect(latest?.managedCount).toBe(1)
      const spawned = latest?.agents.find((agent) => agent.id === 'managed-demo-1')
      expect(spawned?.title).toBe('fix-login')
      expect(spawned?.state).toBe('waiting')
      expect(spawned?.terminal).toBe('managed:managed-demo-1')

      const detail = await demoSession('managed-demo-1', spawned ?? null)
      expect(detail.screen).toContain('⏺ Bash(bun test)')
      expect(detail.entries[0]?.text).toBe('check auth')

      expect(await demoCommand('managed:managed-demo-1', { agentId: 'managed-demo-1', action: 'allow' })).toEqual({
        ok: true,
        error: null
      })
      expect(demoSnapshot().agents.find((agent) => agent.id === 'managed-demo-1')?.state).toBe('working')

      expect(
        await demoCommand('managed:managed-demo-1', { agentId: 'managed-demo-1', action: 'prompt', text: 'add unit test' })
      ).toEqual({ ok: true, error: null })
      const updatedDetail = await demoSession('managed-demo-1', spawned ?? null)
      expect(updatedDetail.entries.some((entry) => entry.role === 'user' && entry.text === 'add unit test')).toBe(true)

      expect(await demoCommand('managed:managed-demo-1', { agentId: 'managed-demo-1', action: 'deny' })).toEqual({
        ok: true,
        error: null
      })
      expect(demoSnapshot().agents.find((agent) => agent.id === 'managed-demo-1')?.state).toBe('done')
    } finally {
      unsubscribe()
    }
  })

  test('enforces 4-session cap with HTTP 429 too_many_sessions and keeps a8 without a terminal', async () => {
    for (let index = 1; index <= 4; index += 1) {
      const reply = await handleSpawn(
        { repoId: 'demo-repo-2', name: `session-${index}` },
        { repos: demoRepos, spawn: demoSpawn }
      )
      expect(reply.status).toBe(200)
    }
    const fifth = await handleSpawn(
      { repoId: 'demo-repo-2', name: 'session-5' },
      { repos: demoRepos, spawn: demoSpawn }
    )
    expect(fifth).toEqual({ status: 429, result: { ok: false, error: 'too_many_sessions' } })
    expect(demoSnapshot().agents.find((agent) => agent.id === 'a8')?.terminal).toBeNull()
  })
})
