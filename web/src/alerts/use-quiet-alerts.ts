import type { OfficeAgent } from '@shared/types'
import { useEffect, useRef } from 'react'
import { canAlert } from './alert-logic'
import { isQuiet, newlyQuiet, quietAlertText } from './quiet-logic'

function permission(): string {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

function notify(agent: OfficeAgent, now: number, onOpen: (agentId: string) => void): void {
  const text = quietAlertText(agent, now)
  const notification = new Notification(text.title, { body: text.body, tag: `quiet:${agent.id}` })
  notification.onclick = () => {
    window.focus()
    onOpen(agent.id)
    notification.close()
  }
}

export function useQuietAlerts(
  agents: readonly OfficeAgent[] | null,
  now: number,
  quietAfterMs: number,
  enabled: boolean,
  onOpen: (agentId: string) => void
): void {
  const previous = useRef<ReadonlySet<string> | null>(null)

  useEffect(() => {
    if (agents === null) {
      previous.current = null
      return
    }
    const known = previous.current
    previous.current = new Set(agents.filter((agent) => isQuiet(agent, now, quietAfterMs)).map((agent) => agent.id))
    if (known === null || !canAlert(enabled, permission(), document.visibilityState)) {
      return
    }
    for (const agent of newlyQuiet(known, agents, now, quietAfterMs)) {
      notify(agent, now, onOpen)
    }
  }, [agents, now, quietAfterMs, enabled, onOpen])
}
