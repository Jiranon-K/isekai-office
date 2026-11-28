import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { OrcaRepo } from '@shared/types'
import { readOnlyReply } from '../read-only'
import { createLocalSource } from '../sources/local'
import {
  appendScreenLines,
  createManagedRunner,
  isLocalInteractiveEnabled,
  maxManagedSessionsFrom,
  type ManagedProcess
} from './runner'

type FakeProcessHandle = {
  process: ManagedProcess
  written: string[]
  killed: boolean
  emitStdout(line: string): void
  emitStderr(line: string): void
  exit(code: number): void
}

function createFakeProcess(): FakeProcessHandle {
  const encoder = new TextEncoder()
  const written: string[] = []
  let stdoutController: ReadableStreamDefaultController<Uint8Array> | null = null
  let stderrController: ReadableStreamDefaultController<Uint8Array> | null = null
  let resolveExit: (code: number) => void = () => {}
  const exited = new Promise<number>((resolve) => {
    resolveExit = resolve
  })
  const handle: FakeProcessHandle = {
    written,
    killed: false,
    process: {
      write(chunk: string): boolean {
        written.push(chunk)
        return true
      },
      kill(): void {
        handle.killed = true
      },
      stdout: new ReadableStream<Uint8Array>({
        start(controller) {
          stdoutController = controller
        }
      }),
      stderr: new ReadableStream<Uint8Array>({
        start(controller) {
          stderrController = controller
        }
      }),
      exited
    },
    emitStdout(line: string): void {
      stdoutController?.enqueue(encoder.encode(`${line}\n`))
    },
    emitStderr(line: string): void {
      stderrController?.enqueue(encoder.encode(`${line}\n`))
    },
    exit(code: number): void {
      stdoutController?.close()
      stderrController?.close()
      resolveExit(code)
    }
  }
  return handle
}

let tempDir = ''

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'isekai-runner-'))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

describe('runner helpers', () => {
  test('clamps max managed sessions and checks interactive toggle', () => {
    expect(maxManagedSessionsFrom(undefined)).toBe(4)
    expect(maxManagedSessionsFrom('0')).toBe(1)
    expect(maxManagedSessionsFrom('99')).toBe(8)
    expect(maxManagedSessionsFrom('6')).toBe(6)
    expect(isLocalInteractiveEnabled(undefined, true)).toBe(true)
    expect(isLocalInteractiveEnabled('0', true)).toBe(false)
    expect(isLocalInteractiveEnabled(undefined, false)).toBe(false)
  })

  test('bounds screen lines to 40 lines and 4 KB', () => {
    const many = appendScreenLines([], Array.from({ length: 60 }, (_, index) => `line-${index}`).join('\n'))
    expect(many).toHaveLength(40)
    expect(many[0]).toBe('line-20')
    const huge = appendScreenLines([], `${'a'.repeat(3000)}\n${'b'.repeat(3000)}`)
    expect(Buffer.byteLength(huge.join('\n'), 'utf8')).toBeLessThanOrEqual(4096)
  })
})

describe('createManagedRunner lifecycle', () => {
  test('enforces allowlist, handles permission allow/deny/interrupt, 4-session cap, and cleanup on exit', async () => {
    const repos: OrcaRepo[] = [{ id: '/work/app', name: 'app' }]
    const handles: FakeProcessHandle[] = []
    let sequence = 0
    const runner = createManagedRunner({
      allowedRepos: async () => repos,
      createUuid: () => {
        sequence += 1
        return `0000000${sequence}-0000-4000-8000-00000000000${sequence}`
      },
      spawnProcess: () => {
        const fake = createFakeProcess()
        handles.push(fake)
        return fake.process
      }
    })

    expect(await runner.spawn({ repoId: '/evil/path', name: 'bad' })).toEqual({ ok: false, error: 'invalid_repo' })
    expect(await runner.spawn({ repoId: '/work/app', name: 'fix-auth', prompt: 'check auth' })).toEqual({ ok: true, error: null })
    expect(runner.activeCount()).toBe(1)
    expect(handles[0]?.written[0]).toContain('"check auth"')

    const agent = runner.listAgents()[0]
    expect(agent?.terminal).toBe(`managed:${agent?.id}`)

    expect(await runner.sendCommand(agent!.id, { agentId: agent!.id, action: 'allow' })).toEqual({
      ok: false,
      error: 'no_pending_prompt'
    })

    handles[0]?.emitStdout(
      JSON.stringify({
        type: 'control_request',
        request_id: 'perm-1',
        request: { subtype: 'can_use_tool', tool_name: 'Bash', input: { command: 'bun test' } }
      })
    )
    await Bun.sleep(10)
    expect(runner.listAgents()[0]?.state).toBe('waiting')
    expect(runner.readSession(agent!.id)?.screen).toContain('⏺ Bash(bun test)')

    expect(await runner.sendCommand(agent!.id, { agentId: agent!.id, action: 'allow' })).toEqual({ ok: true, error: null })
    expect(runner.listAgents()[0]?.state).toBe('working')
    expect(handles[0]?.written.at(-1)).toContain('"behavior":"allow"')

    handles[0]?.emitStdout(
      JSON.stringify({
        type: 'control_request',
        request_id: 'perm-2',
        request: { subtype: 'can_use_tool', tool_name: 'Write', input: { file_path: 'a.ts' } }
      })
    )
    await Bun.sleep(10)
    expect(await runner.sendCommand(agent!.id, { agentId: agent!.id, action: 'deny' })).toEqual({ ok: true, error: null })
    expect(handles[0]?.written.at(-1)).toContain('"behavior":"deny"')

    expect(await runner.sendCommand(agent!.id, { agentId: agent!.id, action: 'prompt', text: 'add test' })).toEqual({
      ok: true,
      error: null
    })
    expect(runner.readSession(agent!.id)?.entries.at(-1)?.text).toBe('add test')

    expect(await runner.sendCommand(agent!.id, { agentId: agent!.id, action: 'escape' })).toEqual({ ok: true, error: null })
    expect(runner.listAgents()[0]?.state).toBe('done')

    for (let index = 2; index <= 4; index += 1) {
      expect(await runner.spawn({ repoId: '/work/app', name: `task-${index}` })).toEqual({ ok: true, error: null })
    }
    expect(runner.activeCount()).toBe(4)
    expect(await runner.spawn({ repoId: '/work/app', name: 'task-5' })).toEqual({ ok: false, error: 'too_many_sessions' })

    handles[0]?.exit(1)
    await Bun.sleep(10)
    expect(runner.activeCount()).toBe(3)
    const exitedAgent = runner.listAgents().find((candidate) => candidate.id === agent!.id)
    expect(exitedAgent?.terminal).toBeNull()
    expect(runner.readSession(agent!.id)?.screen).toContain('Process exited with code 1')
    expect(await runner.spawn({ repoId: '/work/app', name: 'task-5' })).toEqual({ ok: true, error: null })

    runner.dispose()
    expect(handles.slice(1).every((handle) => handle.killed)).toBe(true)
  })

  test('concurrent spawns that race for the last slot never exceed the cap', async () => {
    const runner = createManagedRunner({
      maxSessions: 1,
      allowedRepos: async () => {
        await Bun.sleep(1)
        return [{ id: '/work/app', name: 'app' }]
      },
      spawnProcess: () => createFakeProcess().process
    })
    const results = await Promise.all([1, 2, 3].map(() => runner.spawn({ repoId: '/work/app', name: 'race' })))
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.filter((result) => result.error === 'too_many_sessions').length).toBeGreaterThanOrEqual(1)
    expect(runner.activeCount()).toBe(1)
    runner.dispose()
  })

  test('a prompt during a pending permission is rejected and the session stays waiting', async () => {
    const fake = createFakeProcess()
    const runner = createManagedRunner({
      allowedRepos: async () => [{ id: '/work/app', name: 'app' }],
      createUuid: () => '00000009-0000-4000-8000-000000000009',
      spawnProcess: () => fake.process
    })
    await runner.spawn({ repoId: '/work/app', name: 'pending' })
    const agent = runner.listAgents()[0]!
    fake.emitStdout(
      JSON.stringify({
        type: 'control_request',
        request_id: 'perm-9',
        request: { subtype: 'can_use_tool', tool_name: 'Bash', input: { command: 'bun test' } }
      })
    )
    await Bun.sleep(10)
    const writesBefore = fake.written.length
    expect(await runner.sendCommand(agent.id, { agentId: agent.id, action: 'prompt', text: 'hurry' })).toEqual({
      ok: false,
      error: 'pending_decision'
    })
    expect(fake.written).toHaveLength(writesBefore)
    expect(runner.listAgents()[0]?.state).toBe('waiting')
    expect(await runner.sendCommand(agent.id, { agentId: agent.id, action: 'allow' })).toEqual({ ok: true, error: null })
    expect(runner.listAgents()[0]?.state).toBe('working')
    runner.dispose()
  })

  test('local source merges managed and external sessions deduplicating by sessionId and respects disabled mode', async () => {
    const projectsDir = join(tempDir, 'projects')
    mkdirSync(join(projectsDir, 'p1'), { recursive: true })
    const sharedSessionId = '11111111-1111-4111-8111-111111111111'
    writeFileSync(
      join(projectsDir, 'p1', `${sharedSessionId}.jsonl`),
      `${JSON.stringify({ type: 'user', cwd: '/work/app', message: { content: 'hi' } })}\n`
    )
    writeFileSync(
      join(projectsDir, 'p1', 'external-only.jsonl'),
      `${JSON.stringify({ type: 'user', cwd: '/work/app', message: { content: 'ext' } })}\n`
    )

    const fake = createFakeProcess()
    const runner = createManagedRunner({
      allowedRepos: async () => [{ id: '/work/app', name: 'app' }],
      createUuid: () => sharedSessionId,
      spawnProcess: () => fake.process
    })
    await runner.spawn({ repoId: '/work/app', name: 'managed-one', prompt: 'start' })

    const interactiveSource = createLocalSource({ projectsDir, recentMs: 60 * 60_000, managed: runner })
    expect(interactiveSource.caps).toEqual({ command: true, spawn: true, screen: true })
    expect(interactiveSource.managedStats?.()).toEqual({ count: 1, cap: 4 })
    const agents = await interactiveSource.listAgents()
    expect(agents).toHaveLength(2)
    const managedAgent = agents.find((agent) => agent.session === sharedSessionId)
    const externalAgent = agents.find((agent) => agent.id === 'external-only')
    expect(managedAgent?.terminal).toStartWith('managed:')
    expect(externalAgent?.terminal).toBeNull()

    const disabledSource = createLocalSource({ projectsDir, recentMs: 60 * 60_000, managed: null })
    expect(disabledSource.caps).toEqual({ command: false, spawn: false, screen: false })
    expect(readOnlyReply(disabledSource.caps, 'spawn')).toEqual({ ok: false, error: 'read_only_source' })
    expect(readOnlyReply(disabledSource.caps, 'command')).toEqual({ ok: false, error: 'read_only_source' })
    runner.dispose()
  })
})
