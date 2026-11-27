import type { BoardSnapshot, OfficeAgent } from '@shared/types'
import { useState } from 'react'
import { rosterOrder } from '@/room-panels/panel-data'
import { SessionList } from '@/room-panels/SessionList'
import { soloAgents } from './grouping-logic'
import { PartySection } from './PartySection'
import { useParties } from './use-parties'
import { usePartyGrouping } from './use-party-grouping'

type PartyRosterProps = {
  agents: OfficeAgent[]
  board: BoardSnapshot | null
  contextWindow: number
  quiet: ReadonlyMap<string, number>
  onSelect(agentId: string): void
  flat: React.ReactNode
}

function GroupingSwitch({ grouped, onChange }: { grouped: boolean; onChange(grouped: boolean): void }): React.JSX.Element {
  return (
    <label className="flex items-center gap-2 text-small">
      <input type="checkbox" role="switch" checked={grouped} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-primary" />
      จัดตามปาร์ตี้
    </label>
  )
}

function SoloSection({ agents, quiet, onSelect }: Pick<PartyRosterProps, 'agents' | 'quiet' | 'onSelect'>): React.JSX.Element | null {
  if (agents.length === 0) {
    return null
  }
  return (
    <section aria-label="เดี่ยว" className="flex flex-col gap-1">
      <h3 className="px-2 text-small font-medium text-muted-foreground">{`เดี่ยว (${agents.length})`}</h3>
      <SessionList agents={rosterOrder(agents)} empty="" quiet={quiet} onSelect={onSelect} />
    </section>
  )
}

export function PartyRoster({ agents, board, contextWindow, quiet, onSelect, flat }: PartyRosterProps): React.JSX.Element {
  const [grouped, setGrouped] = usePartyGrouping()
  const [composingKey, setComposingKey] = useState<string | null>(null)
  const found = useParties(agents, board)
  return (
    <>
      <GroupingSwitch grouped={grouped} onChange={setGrouped} />
      {grouped ? (
        <div className="flex flex-col gap-3">
          {found.map((party) => (
            <PartySection
              key={party.key}
              party={party}
              agents={agents}
              contextWindow={contextWindow}
              quiet={quiet}
              composing={composingKey === party.key}
              onToggleComposer={() => setComposingKey((current) => (current === party.key ? null : party.key))}
              onSelect={onSelect}
            />
          ))}
          <SoloSection agents={soloAgents(agents, found)} quiet={quiet} onSelect={onSelect} />
        </div>
      ) : (
        flat
      )}
    </>
  )
}
