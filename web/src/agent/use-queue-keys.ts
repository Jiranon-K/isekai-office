import type { Choice } from '@shared/types'
import { useEffect, useRef } from 'react'
import { isTyping } from '@/lib/keyboard'
import { queueKeyFor, type QueueKey } from './queue-logic'

type QueueKeyHandlers = { choices: readonly Choice[]; boardOpen: boolean; onKey(key: QueueKey): void }

export function useQueueKeys(handlers: QueueKeyHandlers): void {
  const latest = useRef(handlers)
  latest.current = handlers

  useEffect(() => {
    function handle(event: KeyboardEvent): void {
      if (event.repeat || isTyping(event.target)) {
        return
      }
      const key = queueKeyFor(event, latest.current.choices, latest.current.boardOpen)
      if (key === null) {
        return
      }
      event.preventDefault()
      latest.current.onKey(key)
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])
}
