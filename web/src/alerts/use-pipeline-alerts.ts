import type { BoardSnapshot } from '@shared/types'
import { useEffect, useRef } from 'react'
import { canAlert } from './alert-logic'
import { advancePipelines, pipelineAlertText, type PipelineChange } from './pipeline-logic'

function permission(): string {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

function notify(change: PipelineChange, onOpen: () => void): void {
  const text = pipelineAlertText(change)
  const notification = new Notification(text.title, { body: text.body, tag: `pipeline:${change.card.id}:${change.kind}` })
  notification.onclick = () => {
    window.focus()
    onOpen()
    notification.close()
  }
}

export function usePipelineAlerts(board: BoardSnapshot | null, enabled: boolean, onOpen: () => void): void {
  const seen = useRef<BoardSnapshot | null>(null)

  useEffect(() => {
    if (board === null) {
      return
    }
    const step = advancePipelines(seen.current, board)
    seen.current = step.seen
    if (!canAlert(enabled, permission(), document.visibilityState)) {
      return
    }
    for (const change of step.changes) {
      notify(change, onOpen)
    }
  }, [board, enabled, onOpen])
}
