import type { OfficeAgent } from '@shared/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isTyping } from '@/lib/keyboard'
import { waitingQueue } from '@/alerts/jump-logic'
import { afterAnswer, afterSkip, isQueueOpenKey, settle, startQueue, type QueueState } from './queue-logic'

type DecisionQueueOptions = {
  agents: readonly OfficeAgent[]
  boardOpen: boolean
  onFocus(agentId: string | null): void
  onExpand(agentId: string): void
}

export type DecisionQueueControls = {
  state: QueueState | null
  open(): void
  close(): void
  skip(): void
  answered(): void
  expand(agentId: string): void
}

export function useDecisionQueue(options: DecisionQueueOptions): DecisionQueueControls {
  const [state, setState] = useState<QueueState | null>(null)
  const latest = useRef(options)
  latest.current = options
  const currentId = state?.currentId ?? null
  const isOpen = state !== null

  const open = useCallback(() => {
    const { agents } = latest.current
    if (waitingQueue(agents).length === 0) {
      return
    }
    setState(startQueue(agents, Date.now()))
  }, [])

  const close = useCallback(() => {
    setState(null)
    latest.current.onFocus(null)
  }, [])

  const skip = useCallback(() => {
    setState((current) => (current ? afterSkip(current, latest.current.agents, Date.now()) : current))
  }, [])

  const answered = useCallback(() => {
    setState((current) => (current ? afterAnswer(current, latest.current.agents, Date.now()) : current))
  }, [])

  const expand = useCallback((agentId: string) => {
    setState(null)
    latest.current.onExpand(agentId)
  }, [])

  useEffect(() => {
    setState((current) => (current ? settle(current, options.agents, Date.now()) : current))
  }, [options.agents])

  useEffect(() => {
    if (currentId !== null) {
      latest.current.onFocus(currentId)
    }
  }, [currentId])

  useEffect(() => {
    function handle(event: KeyboardEvent): void {
      if (isOpen || !isQueueOpenKey(event, isTyping(event.target), latest.current.boardOpen)) {
        return
      }
      event.preventDefault()
      open()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [isOpen, open])

  const shown = useMemo(() => (state ? { ...state, boardOpen: options.boardOpen } : null), [state, options.boardOpen])

  return { state: shown, open, close, skip, answered, expand }
}
