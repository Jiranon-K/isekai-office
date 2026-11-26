import type { CommandAction } from '@shared/types'
import { useCallback, useEffect, useState } from 'react'
import { sendCommand } from '@/lib/api'
import { describeResult } from './panel-logic'

export type CommandStatus =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; action: CommandAction }
  | { kind: 'failed'; reason: string }

export function useCommand(agentId: string): { status: CommandStatus; run(action: CommandAction, text?: string, choice?: number): Promise<boolean> } {
  const [status, setStatus] = useState<CommandStatus>({ kind: 'idle' })

  useEffect(() => {
    setStatus({ kind: 'idle' })
  }, [agentId])

  const run = useCallback(
    async (action: CommandAction, text?: string, choice?: number): Promise<boolean> => {
      setStatus({ kind: 'sending' })
      try {
        const result = await sendCommand({ agentId, action, text, choice })
        const failure = describeResult(result)
        if (failure) {
          setStatus({ kind: 'failed', reason: failure })
          return false
        }
        setStatus({ kind: 'sent', action })
        return true
      } catch {
        setStatus({ kind: 'failed', reason: 'server_unreachable' })
        return false
      }
    },
    [agentId]
  )

  return { status, run }
}
