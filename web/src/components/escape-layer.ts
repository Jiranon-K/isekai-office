import { useEffect, useRef } from 'react'

type EscapeFacts = Pick<KeyboardEvent, 'key' | 'defaultPrevented' | 'isComposing'>

export function takesEscape(event: EscapeFacts, isTopLayer: boolean): boolean {
  return event.key === 'Escape' && !event.defaultPrevented && !event.isComposing && isTopLayer
}

export function useEscapeLayer(onEscape: () => void, isTopLayer: () => boolean = () => true): void {
  const latest = useRef({ onEscape, isTopLayer })
  latest.current = { onEscape, isTopLayer }
  useEffect(() => {
    function handle(event: KeyboardEvent): void {
      if (!takesEscape(event, latest.current.isTopLayer())) {
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      latest.current.onEscape()
    }
    window.addEventListener('keydown', handle, true)
    return () => window.removeEventListener('keydown', handle, true)
  }, [])
}
