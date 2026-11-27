import type { OfficeAgent } from '@shared/types'
import { Button } from '@/components/ui/button'
import { countAgents } from '@/lib/agent-counts'
import { peakLoad } from '@/office/scene/mana'
import { rosterOrder } from '@/room-panels/panel-data'
import { SessionList } from '@/room-panels/SessionList'
import { PartyComposer } from './PartyComposer'
import type { Party } from './party-logic'
import { Pennant } from './Pennant'

type PartySectionProps = {
  party: Party
  agents: OfficeAgent[]
  contextWindow: number
  quiet: ReadonlyMap<string, number>
  composing: boolean
  onToggleComposer(): void
  onSelect(agentId: string): void
}

function PartyFacts({ party, contextWindow }: { party: Party; contextWindow: number }): React.JSX.Element {
  const counts = countAgents(party.members)
  const peak = peakLoad(party.members.map((member) => member.contextTokens), contextWindow)
  const load = peak === null ? '' : ` · context สูงสุด ${Math.round(peak * 100)}%`
  return <p className="text-caption text-muted-foreground">{`ทำงาน ${counts.working} · รอคุณ ${counts.needsYou}${load}`}</p>
}

export function PartySection({ party, agents, contextWindow, quiet, composing, onToggleComposer, onSelect }: PartySectionProps): React.JSX.Element {
  return (
    <section aria-label={`ปาร์ตี้ ${party.name}`} className="flex flex-col gap-1">
      <div className="flex items-center gap-2 px-2">
        <Pennant colour={party.colour} />
        <h3 className="min-w-0 flex-1 truncate text-small font-medium">{party.name}</h3>
        <Button variant="outline" size="xs" aria-expanded={composing} onClick={onToggleComposer}>
          สั่งทั้งปาร์ตี้
        </Button>
      </div>
      <div className="pr-2 pl-7">
        <PartyFacts party={party} contextWindow={contextWindow} />
      </div>
      {composing ? <PartyComposer party={party} agents={agents} /> : null}
      <SessionList agents={rosterOrder(party.members)} empty="" quiet={quiet} onSelect={onSelect} />
    </section>
  )
}
