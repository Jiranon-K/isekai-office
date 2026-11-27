import type { AgentState } from '@shared/types'

export type Hint = { state: AgentState; at: number }

export type HookPayload = { sessionId: string; event: string; notificationType: string | null; message: string }

export type HintChange = { sessionId: string; hint: Hint | null }

export type HintStore = {
  apply(change: HintChange): void
  get(sessionId: string): Hint | null
  prune(olderThan: number): void
}

const OVERRIDE_MS = 2_000
const MAX_HINTS = 500
const MAX_SESSION_ID_LENGTH = 128
const WORKING_EVENTS = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse']
const PERMISSION_PATTERN = /permission/i

export function parseHook(body: unknown): HookPayload | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const sessionId = Reflect.get(body, 'session_id')
  const event = Reflect.get(body, 'hook_event_name')
  if (typeof sessionId !== 'string' || sessionId === '' || sessionId.length > MAX_SESSION_ID_LENGTH || typeof event !== 'string') {
    return null
  }
  const notificationType = Reflect.get(body, 'notification_type')
  const message = Reflect.get(body, 'message')
  return {
    sessionId,
    event,
    notificationType: typeof notificationType === 'string' ? notificationType : null,
    message: typeof message === 'string' ? message : ''
  }
}

function isPermissionPrompt(payload: HookPayload): boolean {
  if (payload.notificationType !== null) {
    return payload.notificationType === 'permission_prompt'
  }
  return PERMISSION_PATTERN.test(payload.message)
}

function stateFor(payload: HookPayload): AgentState | null {
  if (payload.event === 'Notification') {
    return isPermissionPrompt(payload) ? 'waiting' : null
  }
  if (WORKING_EVENTS.includes(payload.event)) {
    return 'working'
  }
  return payload.event === 'Stop' ? 'done' : null
}

export function hintChangeFrom(payload: HookPayload, now: number): HintChange | null {
  if (payload.event === 'SessionEnd') {
    return { sessionId: payload.sessionId, hint: null }
  }
  const state = stateFor(payload)
  return state === null ? null : { sessionId: payload.sessionId, hint: { state, at: now } }
}

export function applyHint(tailState: AgentState, hint: Hint | null, modifiedAt: number): AgentState {
  if (!hint || modifiedAt - hint.at > OVERRIDE_MS) {
    return tailState
  }
  return hint.state
}

export function createHintStore(): HintStore {
  const hints = new Map<string, Hint>()

  function apply(change: HintChange): void {
    hints.delete(change.sessionId)
    if (!change.hint) {
      return
    }
    hints.set(change.sessionId, change.hint)
    if (hints.size > MAX_HINTS) {
      hints.delete(hints.keys().next().value ?? '')
    }
  }

  function prune(olderThan: number): void {
    for (const [sessionId, hint] of hints) {
      if (hint.at < olderThan) {
        hints.delete(sessionId)
      }
    }
  }

  return { apply, get: (sessionId) => hints.get(sessionId) ?? null, prune }
}

export const hintStore = createHintStore()
