import type { OfficeAgent } from '@shared/types'
import { useEffect, useRef } from 'react'
import { canAlert } from './alert-logic'
import { advanceLoad, highLoadIds, loadAlertText } from './load-logic'

function permission(): string {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

function notify(agent: OfficeAgent, contextWindow: number, onOpen: (agentId: string) => void): void {
  const text = loadAlertText(agent, contextWindow)
  const notification = new Notification(text.title, { body: text.body, tag: `load:${agent.id}` })
  notification.onclick = () => {
    window.focus()
    onOpen(agent.id)
    notification.close()
  }
}

export function useLoadAlerts(
  agents: readonly OfficeAgent[] | null,
  contextWindow: number,
  enabled: boolean,
  onOpen: (agentId: string) => void
): void {
  const armed = useRef<ReadonlySet<string> | null>(null)

  useEffect(() => {
    if (agents === null) {
      armed.current = null
      return
    }
    if (armed.current === null) {
      armed.current = highLoadIds(agents, contextWindow)
      return
    }
    const step = advanceLoad(armed.current, agents, contextWindow)
    armed.current = step.armed
    if (!canAlert(enabled, permission(), document.visibilityState)) {
      return
    }
    for (const agent of step.fresh) {
      notify(agent, contextWindow, onOpen)
    }
  }, [agents, contextWindow, enabled, onOpen])
}
