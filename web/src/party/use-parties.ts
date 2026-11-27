import type { BoardSnapshot, OfficeAgent } from '@shared/types'
import { useMemo } from 'react'
import { parties, partyByAgentId, type Party } from './party-logic'

const NO_CARDS: BoardSnapshot['cards'] = []

export function useParties(agents: OfficeAgent[], board: BoardSnapshot | null): Party[] {
  const cards = board?.cards ?? NO_CARDS
  return useMemo(() => parties(agents, cards), [agents, cards])
}

export function usePartyByAgent(found: Party[]): Map<string, Party> {
  return useMemo(() => partyByAgentId(found), [found])
}
