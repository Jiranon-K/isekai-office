import { describe, expect, test } from 'bun:test'
import { isAllowedRequest } from './guard'
import { handleHook } from './hook'
import { createHintStore } from './sources/hints'

const PORTS = { serverPort: 4300, publicPort: 4300 }

function hookRequest(headers: Record<string, string>): Request {
  return new Request('http://127.0.0.1:4300/api/hook', { method: 'POST', headers })
}

describe('hook route', () => {
  test('the post that scripts/hook.ts sends passes the guard', () => {
    const headers = { host: '127.0.0.1:4300', origin: 'http://127.0.0.1:4300', 'content-type': 'application/json' }
    expect(isAllowedRequest(hookRequest(headers), PORTS)).toBe(true)
  })

  test('a hook post without an origin, from another site or without json is refused', () => {
    expect(isAllowedRequest(hookRequest({ host: '127.0.0.1:4300', 'content-type': 'application/json' }), PORTS)).toBe(false)
    expect(isAllowedRequest(hookRequest({ host: '127.0.0.1:4300', origin: 'https://evil.example', 'content-type': 'application/json' }), PORTS)).toBe(false)
    expect(isAllowedRequest(hookRequest({ host: '127.0.0.1:4300', origin: 'http://127.0.0.1:4300', 'content-type': 'text/plain' }), PORTS)).toBe(false)
  })

  test('a Claude Code payload stores a hint and answers ok', () => {
    const store = createHintStore()
    const reply = handleHook({ session_id: 'abc', hook_event_name: 'Notification', notification_type: 'permission_prompt' }, store, 500)
    expect(reply).toEqual({ status: 200, body: { ok: true } })
    expect(store.get('abc')).toEqual({ state: 'waiting', at: 500 })
  })

  test('an event the room does not use is accepted without a hint', () => {
    const store = createHintStore()
    expect(handleHook({ session_id: 'abc', hook_event_name: 'SessionStart' }, store, 1).status).toBe(200)
    expect(store.get('abc')).toBeNull()
  })

  test('a body that is not a hook payload is a 400', () => {
    expect(handleHook({ nope: true }, createHintStore(), 1)).toEqual({ status: 400, body: { ok: false, error: 'bad_request' } })
    expect(handleHook(null, createHintStore(), 1).status).toBe(400)
  })
})
