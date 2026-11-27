export type PartyMember = { id: string; partyKey: string | null }

export function ringedPartyKey(members: Iterable<PartyMember>, hoveredId: string | null, selectedId: string | null): string | null {
  if (hoveredId === null && selectedId === null) {
    return null
  }
  let selectedKey: string | null = null
  for (const member of members) {
    if (member.id === hoveredId && member.partyKey !== null) {
      return member.partyKey
    }
    if (member.id === selectedId) {
      selectedKey = member.partyKey
    }
  }
  return selectedKey
}
