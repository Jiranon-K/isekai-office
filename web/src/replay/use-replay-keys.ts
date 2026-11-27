import { useEffect, useRef } from 'react'
import { isTypingTarget, replayKeyAction, type ReplayKeyAction } from './replay-keys'

export function useReplayKeys(active: boolean, onAction: (action: ReplayKeyAction) => void): void {
  const latest = useRef(onAction)
  latest.current = onAction
  useEffect(() => {
    if (!active) {
      return
    }
    function handle(event: KeyboardEvent): void {
      const action = replayKeyAction(event, isTypingTarget(event.target))
      if (action === null) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      latest.current(action)
    }
    window.addEventListener('keydown', handle, true)
    return () => window.removeEventListener('keydown', handle, true)
  }, [active])
}
