export type PartyMember = { id: string; partyKey: string | null }

export function ringedPartyKey(members: Iterable<PartyMember>, hoveredId: string | null, selectedId: string | null): string | null {
  const keyById = new Map<string, string | null>()
  for (const member of members) {
    keyById.set(member.id, member.partyKey)
  }
  const hovered = hoveredId ? keyById.get(hoveredId) : null
  return hovered ?? (selectedId ? keyById.get(selectedId) ?? null : null)
}
