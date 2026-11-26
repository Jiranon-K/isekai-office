import type { BoardSnapshot, QuestCard } from '@shared/types'
import type { AlertText } from './alert-logic'

export type PipelineChange = { card: QuestCard; kind: 'failed' | 'recovered' }

export type PipelineStep = { seen: BoardSnapshot | null; changes: PipelineChange[] }

const FAILED_BODY = 'pipeline ไม่ผ่าน'
const RECOVERED_BODY = 'pipeline กลับมาผ่านแล้ว'

function pipelineOf(card: QuestCard | undefined): string | null {
  return card?.mergeRequest?.pipeline ?? null
}

function changeFor(before: QuestCard | undefined, card: QuestCard): PipelineChange | null {
  const was = pipelineOf(before)
  const now = pipelineOf(card)
  if (now === 'failed' && was !== 'failed') {
    return { card, kind: 'failed' }
  }
  if (now === 'success' && was === 'failed') {
    return { card, kind: 'recovered' }
  }
  return null
}

export function pipelineChanges(previous: BoardSnapshot | null, current: BoardSnapshot): PipelineChange[] {
  if (previous === null) {
    return []
  }
  const before = new Map(previous.cards.map((card) => [card.id, card]))
  return current.cards.flatMap((card) => changeFor(before.get(card.id), card) ?? [])
}

export function advancePipelines(seen: BoardSnapshot | null, current: BoardSnapshot): PipelineStep {
  if (current.error !== null) {
    return { seen, changes: [] }
  }
  return { seen: current, changes: pipelineChanges(seen, current) }
}

export function pipelineAlertText(change: PipelineChange): AlertText {
  const { card, kind } = change
  const title = card.key ? `${card.key} ${card.title}` : card.title
  return { title, body: kind === 'failed' ? FAILED_BODY : RECOVERED_BODY }
}

export function shouldPoll(keepPolling: boolean, visibility: string): boolean {
  return keepPolling || visibility === 'visible'
}
