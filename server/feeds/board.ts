import type { BoardSnapshot, MergeRequestFacts, QuestCard, Sprint } from '@shared/types'
import { mergeRequestFacts } from '../sources/gitlab'
import { loadLoopStages } from '../sources/loop-state'
import { loadCards, loadSprints } from '../sources/workspace'

const FRESH_MS = 55_000

let cached: BoardSnapshot | null = null
let pending: Promise<BoardSnapshot> | null = null

export function withMergeRequest(card: QuestCard, facts: Map<string, MergeRequestFacts>): QuestCard {
  const url = card.loop?.mr
  return { ...card, mergeRequest: url ? (facts.get(url) ?? null) : null }
}

export function wantsMergeRequestFacts(card: QuestCard, sprints: Sprint[]): boolean {
  if (!card.loop?.mr) {
    return false
  }
  const inRunningSprint = sprints.some((sprint) => sprint.state === 'running' && sprint.space === card.space && sprint.name === card.sprint)
  return inRunningSprint || card.column !== 'done'
}

async function sprintsOrCached(): Promise<Sprint[]> {
  return loadSprints().catch(() => cached?.sprints ?? [])
}

async function joinFacts(cards: QuestCard[], sprints: Sprint[]): Promise<QuestCard[]> {
  const urls = cards.flatMap((card) => (wantsMergeRequestFacts(card, sprints) && card.loop?.mr ? [card.loop.mr] : []))
  const facts = await mergeRequestFacts(urls).catch(() => new Map<string, MergeRequestFacts>())
  return cards.map((card) => withMergeRequest(card, facts))
}

async function fetchBoard(): Promise<BoardSnapshot> {
  try {
    const [stages, sprints] = await Promise.all([loadLoopStages(), sprintsOrCached()])
    const cards = await joinFacts(await loadCards(stages), sprints)
    return { cards, sprints, error: null, at: Date.now() }
  } catch (error) {
    return {
      cards: cached?.cards ?? [],
      sprints: cached?.sprints ?? [],
      error: error instanceof Error ? error.message : String(error),
      at: Date.now()
    }
  }
}

export async function board(force: boolean): Promise<BoardSnapshot> {
  if (!force && cached && Date.now() - cached.at < FRESH_MS) {
    return cached
  }
  pending ??= fetchBoard().finally(() => {
    pending = null
  })
  cached = await pending
  return cached
}
