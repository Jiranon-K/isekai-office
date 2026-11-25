import type { QuestCard, Sprint } from '@shared/types'
import type { BoardFilter, BoardItem } from './monitor-logic'

export const GATES = ['spec', 'mr', 'pipeline', 'merged', 'tag'] as const

export type GateName = (typeof GATES)[number]

export type GateState = 'pass' | 'wait' | 'fail' | 'unknown'

export type Gate = { state: GateState; detail: string | null; url: string | null }

export type ReleaseRow = { item: BoardItem; gates: Record<GateName, Gate> }

export type GateProgress = Record<GateName, { pass: number; total: number }>

export type ReleaseRound = {
  sprint: Sprint
  rows: ReleaseRow[]
  progress: GateProgress
  daysLeft: number | null
}

export type TagStage = 'dev' | 'staging' | 'production'

export const GATE_LABELS: Record<GateName, string> = {
  spec: 'spec',
  mr: 'MR',
  pipeline: 'pipeline',
  merged: 'merged',
  tag: 'tag'
}

const OUTSIDE_LOOP = 'นอก Loop'
const MS_PER_DAY = 86_400_000
const STAGE_RANK: Record<TagStage, number> = { dev: 0, staging: 1, production: 2 }
const SPEC_PENDING = new Set(['designing', 'design_ready'])

function gate(state: GateState, detail: string | null = null, url: string | null = null): Gate {
  return { state, detail, url }
}

export function tagStage(tag: string): TagStage | null {
  if (/-beta/.test(tag)) {
    return 'dev'
  }
  if (/-rc/.test(tag)) {
    return 'staging'
  }
  if (/^v?\d+\.\d+\.\d+$/.test(tag)) {
    return 'production'
  }
  return null
}

export function furthestTag(tags: string[]): { tag: string; stage: TagStage } | null {
  let best: { tag: string; stage: TagStage } | null = null
  for (const tag of tags) {
    const stage = tagStage(tag)
    if (stage && (!best || STAGE_RANK[stage] >= STAGE_RANK[best.stage])) {
      best = { tag, stage }
    }
  }
  return best
}

const MERGED_OUTSIDE_MR = 'merge นอก MR'

function specGate(card: QuestCard): Gate {
  if (!card.loop) {
    return gate('unknown', OUTSIDE_LOOP)
  }
  if (card.loop.status === 'design_ready') {
    return gate('wait', 'รอตรวจ')
  }
  return gate(SPEC_PENDING.has(card.loop.status) ? 'wait' : 'pass')
}

function mergeRequestNumber(card: QuestCard): string | null {
  if (card.mergeRequest) {
    return `!${card.mergeRequest.iid}`
  }
  const matched = card.loop?.mr?.match(/merge_requests\/(\d+)/)
  return matched ? `!${matched[1]}` : null
}

function mrGate(card: QuestCard): Gate {
  if (!card.loop) {
    return gate('unknown')
  }
  if (!card.loop.mr) {
    return gate('wait')
  }
  return gate('pass', mergeRequestNumber(card), card.mergeRequest?.url ?? card.loop.mr)
}

const PIPELINE_STATES: Record<string, GateState> = { success: 'pass', failed: 'fail', canceled: 'fail' }

function pipelineGate(card: QuestCard): Gate {
  const status = card.mergeRequest?.pipeline
  if (!card.loop || !status) {
    return gate('unknown')
  }
  if (status === 'skipped' || status === 'other') {
    return gate('unknown', status)
  }
  const state = PIPELINE_STATES[status]
  return gate(state ?? 'wait', state === 'pass' ? null : status)
}

function mergedGate(card: QuestCard): Gate {
  if (!card.loop) {
    return card.column === 'done' ? gate('pass', 'ตาม Workspace') : gate('unknown')
  }
  if (card.mergeRequest?.state === 'closed' && card.loop.status === 'merged') {
    return gate('pass', MERGED_OUTSIDE_MR)
  }
  if (card.mergeRequest) {
    const states = { merged: 'pass', closed: 'fail', opened: 'wait' } as const
    return gate(states[card.mergeRequest.state])
  }
  if (card.loop.status === 'merged') {
    return gate('pass')
  }
  return card.loop.mr ? gate('unknown') : gate('wait')
}

function tagGate(card: QuestCard): Gate {
  if (!card.loop || !card.mergeRequest || card.mergeRequest.state === 'closed') {
    return gate('unknown')
  }
  const furthest = furthestTag(card.mergeRequest.tags)
  if (!furthest) {
    return gate('wait')
  }
  return gate(furthest.stage === 'production' ? 'pass' : 'wait', furthest.tag)
}

export function gatesFor(card: QuestCard): Record<GateName, Gate> {
  return {
    spec: specGate(card),
    mr: mrGate(card),
    pipeline: pipelineGate(card),
    merged: mergedGate(card),
    tag: tagGate(card)
  }
}

function sprintsForFilter(sprints: Sprint[], filter: BoardFilter): Sprint[] {
  return sprints.filter((sprint) => {
    if (filter.space && sprint.space !== filter.space) {
      return false
    }
    if (filter.sprint.kind === 'named') {
      return sprint.name === filter.sprint.name
    }
    if (filter.sprint.kind === 'running') {
      return sprint.state === 'running'
    }
    return sprint.state !== 'closed'
  })
}

export function daysLeft(endDate: string | null, today: Date): number | null {
  if (!endDate) {
    return null
  }
  const end = Date.parse(`${endDate.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(end)) {
    return null
  }
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((end - start) / MS_PER_DAY)
}

function progressOf(rows: ReleaseRow[]): GateProgress {
  const progress = {} as GateProgress
  for (const name of GATES) {
    progress[name] = { pass: rows.filter((row) => row.gates[name].state === 'pass').length, total: rows.length }
  }
  return progress
}

function roundFor(sprint: Sprint, items: BoardItem[], today: Date): ReleaseRound {
  const rows = items
    .filter((item) => item.card.space === sprint.space && item.card.sprint === sprint.name)
    .map((item) => ({ item, gates: gatesFor(item.card) }))
  return { sprint, rows, progress: progressOf(rows), daysLeft: daysLeft(sprint.endDate, today) }
}

export function releaseRounds(items: BoardItem[], sprints: Sprint[], filter: BoardFilter, today: Date): ReleaseRound[] {
  return sprintsForFilter(sprints, filter).map((sprint) => roundFor(sprint, items, today))
}
