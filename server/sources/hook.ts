import { hintChangeFrom, hintStore, parseHook, type HintStore } from './hints'

export type HookReply = { status: number; body: { ok: boolean; error?: string } }

export function handleHook(body: unknown, store: HintStore = hintStore, now: number = Date.now()): HookReply {
  const payload = parseHook(body)
  if (!payload) {
    return { status: 400, body: { ok: false, error: 'bad_request' } }
  }
  const change = hintChangeFrom(payload, now)
  if (change) {
    store.apply(change)
  }
  return { status: 200, body: { ok: true } }
}
