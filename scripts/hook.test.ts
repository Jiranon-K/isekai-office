import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { hookUrl, originOf, postHook } from './hook-post'
import { hookCommand, hooksSettings } from './hooks-snippet'

const HOOK_SCRIPT = join(import.meta.dir, 'hook.ts')

async function runHook(stdin: string, env: Record<string, string>): Promise<{ code: number; ms: number }> {
  const started = performance.now()
  const child = Bun.spawn(['bun', HOOK_SCRIPT], { stdin: new Blob([stdin]), stdout: 'pipe', stderr: 'pipe', env: { ...process.env, ...env } })
  const code = await child.exited
  return { code, ms: performance.now() - started }
}

describe('hook client', () => {
  test('the port comes from ISEKAI_PORT and falls back to 4300', () => {
    expect(hookUrl('4319')).toBe('http://127.0.0.1:4319/api/hook')
    for (const value of [undefined, '', 'abc', '0', '70000', '1.5']) {
      expect(hookUrl(value)).toBe('http://127.0.0.1:4300/api/hook')
    }
    expect(originOf('http://127.0.0.1:4319/api/hook')).toBe('http://127.0.0.1:4319')
  })

  test('a post to a closed port gives false and never throws', async () => {
    expect(await postHook('http://127.0.0.1:1/api/hook', '{}', 500)).toBe(false)
  })

  test('the post carries an Origin and a json content type', async () => {
    let seen: Headers | null = null
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch(request) {
        seen = request.headers
        return Response.json({ ok: true })
      }
    })
    const port = server.port
    const delivered = await postHook(`http://127.0.0.1:${port}/api/hook`, '{"session_id":"a"}')
    await server.stop(true)
    expect(delivered).toBe(true)
    expect(seen).not.toBeNull()
    const headers = seen as unknown as Headers
    expect(headers.get('origin')).toBe(`http://127.0.0.1:${port}`)
    expect(headers.get('content-type')).toBe('application/json')
  })

  test('the script exits 0 within 1.5 seconds with no server listening', async () => {
    const result = await runHook('{"session_id":"a","hook_event_name":"Stop"}', { ISEKAI_PORT: '1' })
    expect(result.code).toBe(0)
    expect(result.ms).toBeLessThan(1500)
  })

  test('the script posts only the four fields the room needs', async () => {
    let received: unknown = null
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      async fetch(request) {
        received = await request.json()
        return Response.json({ ok: true })
      }
    })
    const payload = { session_id: 'a', hook_event_name: 'Notification', notification_type: 'permission_prompt', message: 'needs permission', tool_input: { command: 'secret' }, cwd: '/x' }
    await runHook(JSON.stringify(payload), { ISEKAI_PORT: String(server.port) })
    await server.stop(true)
    expect(received).toEqual({ session_id: 'a', hook_event_name: 'Notification', notification_type: 'permission_prompt', message: 'needs permission' })
  })

  test('the script exits 0 on empty input and on input that is not json', async () => {
    expect((await runHook('', { ISEKAI_PORT: '1' })).code).toBe(0)
    expect((await runHook('not json', { ISEKAI_PORT: '1' })).code).toBe(0)
  })
})

describe('hooks snippet', () => {
  test('the command quotes the script path and uses forward slashes on Windows', () => {
    expect(hookCommand('D:\\Project\\isekai\\scripts\\hook.ts')).toBe('bun "D:/Project/isekai/scripts/hook.ts"')
  })

  test('every event the room needs is hooked and the notification is limited to permission prompts', () => {
    const { hooks } = hooksSettings('/x/hook.ts')
    expect(Object.keys(hooks).sort()).toEqual(['Notification', 'PostToolUse', 'PreToolUse', 'SessionEnd', 'Stop', 'UserPromptSubmit'])
    expect(hooks.Notification?.[0]?.matcher).toBe('permission_prompt')
    expect(hooks.Stop?.[0]?.hooks[0]).toEqual({ type: 'command', command: 'bun "/x/hook.ts"', timeout: 2 })
  })
})
