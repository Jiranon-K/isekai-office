import { countAgents } from '@/lib/agent-counts'
import { peakLoad } from '@/office/scene/mana'
import { rosterOrder } from '@/room-panels/panel-data'
import { SessionList } from '@/room-panels/SessionList'
import type { Party } from './party-logic'
import { Pennant } from './Pennant'

type PartySectionProps = {
  party: Party
  contextWindow: number
  quiet: ReadonlyMap<string, number>
  onSelect(agentId: string): void
}

function PartyFacts({ party, contextWindow }: { party: Party; contextWindow: number }): React.JSX.Element {
  const counts = countAgents(party.members)
  const peak = peakLoad(party.members.map((member) => member.contextTokens), contextWindow)
  const load = peak === null ? '' : ` · context สูงสุด ${Math.round(peak * 100)}%`
  return <p className="text-caption text-muted-foreground">{`ทำงาน ${counts.working} · รอคุณ ${counts.needsYou}${load}`}</p>
}

export function PartySection({ party, contextWindow, quiet, onSelect }: PartySectionProps): React.JSX.Element {
  return (
    <section aria-label={`ปาร์ตี้ ${party.name}`} className="flex flex-col gap-1">
      <div className="flex items-center gap-2 px-2">
        <Pennant colour={party.colour} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-small font-medium">{party.name}</h3>
          <PartyFacts party={party} contextWindow={contextWindow} />
        </div>
      </div>
      <SessionList agents={rosterOrder(party.members)} empty="" quiet={quiet} onSelect={onSelect} />
    </section>
  )
}
