import type { OfficeAgent } from '@shared/types'
import { Badge } from '@/components/badge'
import { QuestCardView } from './QuestCardView'
import type { BoardItem } from './monitor-logic'
import { inboxGroups } from './view-logic'

type WaitingLaneProps = { items: BoardItem[]; agents: OfficeAgent[]; onSendToAgent(agentId: string): void }

export function WaitingLane({ items, agents, onSendToAgent }: WaitingLaneProps): React.JSX.Element {
  const groups = inboxGroups(items)
  return (
    <section aria-labelledby="waiting-lane" className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <h2 id="waiting-lane" className="text-body-strong">รอผม</h2>
        <Badge variant={items.length > 0 ? 'amber' : 'muted'}>{items.length}</Badge>
      </header>
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-small text-muted-foreground">ไม่มีงานที่รอคุณตอนนี้</p>
      ) : (
        groups.map((group) => (
          <section key={group.reason} aria-labelledby={`wait-${group.reason}`} className="flex flex-col gap-1.5">
            <header className="flex items-center gap-2 px-1">
              <h3 id={`wait-${group.reason}`} className="text-small font-medium text-muted-foreground">{group.label}</h3>
              <span className="text-caption text-muted-foreground tabular-nums">{group.items.length}</span>
            </header>
            <ul className="rounded-lg border border-border bg-card text-card-foreground">
              {group.items.map((item) => (
                <QuestCardView key={item.card.id} item={item} agents={agents} onSendToAgent={onSendToAgent} />
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  )
}
