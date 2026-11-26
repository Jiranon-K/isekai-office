import { useEffect, useRef } from 'react'
import type { OfficeAgent } from '@shared/types'
import { isTyping } from '@/lib/keyboard'
import { isJumpKey, nextWaiting } from './jump-logic'

type JumpState = { agents: readonly OfficeAgent[]; currentId: string | null; boardOpen: boolean; onPick(agentId: string): void }

export function useJumpKey(state: JumpState): void {
  const latest = useRef(state)
  latest.current = state

  useEffect(() => {
    function handle(event: KeyboardEvent): void {
      const { agents, currentId, boardOpen, onPick } = latest.current
      if (!isJumpKey(event, isTyping(event.target), boardOpen)) {
        return
      }
      const next = nextWaiting(agents, currentId)
      if (next === null) {
        return
      }
      event.preventDefault()
      onPick(next)
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])
}
