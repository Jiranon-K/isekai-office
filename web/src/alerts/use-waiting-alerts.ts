import type { OfficeAgent } from '@shared/types'
import { useEffect, useRef } from 'react'
import { countAgents } from '@/lib/agent-counts'
import { alertText, canAlert, newlyWaiting, tabTitle } from './alert-logic'

function permission(): string {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

function notify(agent: OfficeAgent, onOpen: (agentId: string) => void): void {
  const text = alertText(agent)
  const notification = new Notification(text.title, { body: text.body, tag: agent.id })
  notification.onclick = () => {
    window.focus()
    onOpen(agent.id)
    notification.close()
  }
}

export function useWaitingAlerts(agents: readonly OfficeAgent[] | null, enabled: boolean, onOpen: (agentId: string) => void): void {
  const previous = useRef<readonly OfficeAgent[] | null>(null)
  const needsYou = countAgents([...(agents ?? [])]).needsYou

  useEffect(() => {
    document.title = tabTitle(needsYou)
  }, [needsYou])

  useEffect(() => {
    if (agents === null) {
      return
    }
    const fresh = newlyWaiting(previous.current, agents)
    previous.current = agents
    if (!canAlert(enabled, permission(), document.visibilityState)) {
      return
    }
    for (const agent of fresh) {
      notify(agent, onOpen)
    }
  }, [agents, enabled, onOpen])
}
