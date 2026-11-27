import { isTyping } from '@/lib/keyboard'

export type ReplayKeyAction = 'toggle' | 'previous' | 'next' | 'leave'

type KeyFacts = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'repeat'>

const ACTIONS: Record<string, ReplayKeyAction> = {
  ' ': 'toggle',
  ArrowLeft: 'previous',
  ArrowRight: 'next',
  Escape: 'leave'
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement && target.type === 'range') {
    return false
  }
  return isTyping(target)
}

export function replayKeyAction(event: KeyFacts, typing: boolean): ReplayKeyAction | null {
  if (typing || event.ctrlKey || event.metaKey || event.altKey) {
    return null
  }
  const action = ACTIONS[event.key] ?? null
  if (action === 'toggle' && event.repeat) {
    return null
  }
  return action
}
