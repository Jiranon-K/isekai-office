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

export type KeySituation = { onButton: boolean; panelOpen: boolean }

const CALM: KeySituation = { onButton: false, panelOpen: false }

export function isButtonTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLButtonElement
}

function blockedBySituation(action: ReplayKeyAction | null, situation: KeySituation): boolean {
  if (action === 'toggle') {
    return situation.onButton
  }
  return action === 'leave' && situation.panelOpen
}

export function replayKeyAction(event: KeyFacts, typing: boolean, situation: KeySituation = CALM): ReplayKeyAction | null {
  if (typing || event.ctrlKey || event.metaKey || event.altKey) {
    return null
  }
  const action = ACTIONS[event.key] ?? null
  if (action === 'toggle' && event.repeat) {
    return null
  }
  return blockedBySituation(action, situation) ? null : action
}
