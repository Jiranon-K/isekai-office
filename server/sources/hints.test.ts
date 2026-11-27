import { describe, expect, test } from 'bun:test'
import { applyHint, createHintStore, hintChangeFrom, parseHook } from './hints'

const NOW = 1_000_000

function change(body: Record<string, unknown>) {
  const payload = parseHook({ session_id: 's1', ...body })
  return payload ? hintChangeFrom(payload, NOW) : null
}

describe('hook events to hints', () => {
  test('a permission prompt is waiting', () => {
    expect(change({ hook_event_name: 'Notification', notification_type: 'permission_prompt' })).toEqual({ sessionId: 's1', hint: { state: 'waiting', at: NOW } })
  })

  test('an idle notification gives no hint so a done agent stays done', () => {
    expect(change({ hook_event_name: 'Notification', notification_type: 'idle_prompt', message: 'Claude is waiting for your input' })).toBeNull()
  })

  test('without a notification type the message tells a permission prompt from an idle one', () => {
    expect(change({ hook_event_name: 'Notification', message: 'Claude needs your permission to use Bash' })?.hint?.state).toBe('waiting')
    expect(change({ hook_event_name: 'Notification', message: 'Claude is waiting for your input' })).toBeNull()
  })

  test('a prompt, a tool start and a tool end are working', () => {
    for (const event of ['UserPromptSubmit', 'PreToolUse', 'PostToolUse']) {
      expect(change({ hook_event_name: event })?.hint?.state).toBe('working')
    }
  })

  test('stop is done', () => {
    expect(change({ hook_event_name: 'Stop' })?.hint).toEqual({ state: 'done', at: NOW })
  })

  test('session end removes the hint', () => {
    expect(change({ hook_event_name: 'SessionEnd', reason: 'other' })).toEqual({ sessionId: 's1', hint: null })
  })

  test('other events and payloads without a session are ignored', () => {
    expect(change({ hook_event_name: 'SessionStart' })).toBeNull()
    expect(parseHook({ hook_event_name: 'Stop' })).toBeNull()
    expect(parseHook({ session_id: '', hook_event_name: 'Stop' })).toBeNull()
    expect(parseHook(null)).toBeNull()
    expect(parseHook('Stop')).toBeNull()
  })
})

describe('applyHint', () => {
  test('a fresh hint replaces the state read from the transcript', () => {
    expect(applyHint('working', { state: 'waiting', at: NOW }, NOW - 5_000)).toBe('waiting')
    expect(applyHint('working', { state: 'waiting', at: NOW }, NOW + 2_000)).toBe('waiting')
  })

  test('a transcript modified more than 2 seconds after the hint wins', () => {
    expect(applyHint('working', { state: 'waiting', at: NOW }, NOW + 2_001)).toBe('working')
    expect(applyHint('done', { state: 'working', at: NOW }, NOW + 10_000)).toBe('done')
  })

  test('no hint leaves the transcript state', () => {
    expect(applyHint('done', null, NOW)).toBe('done')
  })
})

describe('hint store', () => {
  test('a hint is kept per session and replaced by the next one', () => {
    const store = createHintStore()
    store.apply({ sessionId: 'a', hint: { state: 'working', at: 1 } })
    store.apply({ sessionId: 'a', hint: { state: 'done', at: 2 } })
    store.apply({ sessionId: 'b', hint: { state: 'waiting', at: 3 } })
    expect(store.get('a')).toEqual({ state: 'done', at: 2 })
    expect(store.get('b')).toEqual({ state: 'waiting', at: 3 })
    expect(store.get('c')).toBeNull()
  })

  test('a null hint removes the session and old hints are pruned', () => {
    const store = createHintStore()
    store.apply({ sessionId: 'a', hint: { state: 'working', at: 1 } })
    store.apply({ sessionId: 'b', hint: { state: 'working', at: 100 } })
    store.apply({ sessionId: 'c', hint: { state: 'working', at: 100 } })
    store.apply({ sessionId: 'c', hint: null })
    store.prune(50)
    expect(store.get('a')).toBeNull()
    expect(store.get('b')).not.toBeNull()
    expect(store.get('c')).toBeNull()
  })

  test('the store never grows past a bound', () => {
    const store = createHintStore()
    for (let index = 0; index < 600; index += 1) {
      store.apply({ sessionId: `s${index}`, hint: { state: 'working', at: index } })
    }
    expect(store.get('s0')).toBeNull()
    expect(store.get('s599')).not.toBeNull()
  })
})
