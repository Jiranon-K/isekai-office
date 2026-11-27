import type { OfficeAgent, QuestCard } from '@shared/types'
import { canReceive } from '@/agent/receive-logic'
import { agentForCard } from '@/board/monitor-logic'
import { hashString } from '@/office/scene/hash'

export { canReceive }

export const PARTY_COLOURS = ['party-1', 'party-2', 'party-3', 'party-4', 'party-5', 'party-6'] as const

export type PartyColour = (typeof PARTY_COLOURS)[number]

export type PartyKind = 'epic' | 'repo'

export type Party = {
  key: string
  kind: PartyKind
  name: string
  colour: PartyColour
  members: OfficeAgent[]
}

export type BroadcastRow = {
  agentId: string
  status: 'idle' | 'sending' | 'sent' | 'failed' | 'skipped'
  reason: string | null
}

export type SkippedMember = { agent: OfficeAgent; reason: string }

export const MINIMUM_MEMBERS = 2

const EPIC_PREFIX = 'epic:'
const REPO_PREFIX = 'repo:'

export const SKIP_REASONS = {
  working: 'กำลังทำงานอยู่',
  asking: 'กำลังรอคำตอบ',
  noTerminal: 'ไม่มี terminal'
} as const

export function colourOf(key: string): PartyColour {
  return PARTY_COLOURS[hashString(key) % PARTY_COLOURS.length] ?? PARTY_COLOURS[0]
}

function byEpicThenNewest(first: QuestCard, second: QuestCard): number {
  const firstOpen = first.column === 'done' ? 1 : 0
  const secondOpen = second.column === 'done' ? 1 : 0
  return firstOpen - secondOpen || second.updatedAt.localeCompare(first.updatedAt)
}

function epicOf(agent: OfficeAgent, cards: readonly QuestCard[]): string | null {
  const matched = cards.filter((card) => card.epic && agentForCard(card, [agent])?.id === agent.id)
  const epic = [...matched].sort(byEpicThenNewest)[0]?.epic?.trim()
  return epic ? epic : null
}

function repoKeyOf(agent: OfficeAgent): string | null {
  return agent.repo ? `${REPO_PREFIX}${agent.repo}` : null
}

export function partyKeyOf(agent: OfficeAgent, cards: readonly QuestCard[]): string | null {
  const epic = epicOf(agent, cards)
  return epic ? `${EPIC_PREFIX}${epic.toLowerCase()}` : repoKeyOf(agent)
}

function groupByKey(agents: readonly OfficeAgent[], keyOf: (agent: OfficeAgent) => string | null): Map<string, OfficeAgent[]> {
  const groups = new Map<string, OfficeAgent[]>()
  for (const agent of agents) {
    const key = keyOf(agent)
    if (key) {
      groups.set(key, [...(groups.get(key) ?? []), agent])
    }
  }
  return groups
}

function partyNameOf(key: string, kind: PartyKind, first: OfficeAgent, cards: readonly QuestCard[]): string {
  if (kind === 'epic') {
    return epicOf(first, cards) ?? key.slice(EPIC_PREFIX.length)
  }
  return key.slice(REPO_PREFIX.length)
}

function toParties(groups: Map<string, OfficeAgent[]>, cards: readonly QuestCard[]): Party[] {
  const found: Party[] = []
  for (const [key, members] of groups) {
    if (members.length < MINIMUM_MEMBERS) {
      continue
    }
    const kind: PartyKind = key.startsWith(EPIC_PREFIX) ? 'epic' : 'repo'
    const name = partyNameOf(key, kind, members[0] as OfficeAgent, cards)
    found.push({ key, kind, name, colour: colourOf(key), members })
  }
  return found.sort((first, second) => first.name.localeCompare(second.name))
}

export function parties(agents: readonly OfficeAgent[], cards: readonly QuestCard[]): Party[] {
  const epicParties = toParties(groupByKey(agents, (agent) => {
    const key = partyKeyOf(agent, cards)
    return key?.startsWith(EPIC_PREFIX) ? key : null
  }), cards)
  const placed = new Set(epicParties.flatMap((party) => party.members.map((member) => member.id)))
  const unplaced = agents.filter((agent) => !placed.has(agent.id))
  return [...epicParties, ...toParties(groupByKey(unplaced, repoKeyOf), cards)]
}

export function partyByAgentId(found: readonly Party[]): Map<string, Party> {
  const byAgent = new Map<string, Party>()
  for (const party of found) {
    for (const member of party.members) {
      byAgent.set(member.id, party)
    }
  }
  return byAgent
}

export function skipReasonOf(agent: OfficeAgent): string | null {
  if (canReceive(agent)) {
    return null
  }
  if (agent.terminal === null) {
    return SKIP_REASONS.noTerminal
  }
  return agent.state === 'working' ? SKIP_REASONS.working : SKIP_REASONS.asking
}

export function receivers(party: Party): OfficeAgent[] {
  return party.members.filter(canReceive)
}

export function skippedWithReason(party: Party): SkippedMember[] {
  return party.members.flatMap((agent) => {
    const reason = skipReasonOf(agent)
    return reason ? [{ agent, reason }] : []
  })
}
