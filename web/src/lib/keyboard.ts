export function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))
}

export function isRevealKey(event: Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey'>): boolean {
  return event.key === '?' || (event.code === 'Slash' && event.shiftKey)
}
