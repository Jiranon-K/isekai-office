import type { OfficeAgent } from '@shared/types'
import { cn } from '@/lib/utils'
import { QuestCardView } from './QuestCardView'
import type { BoardItem } from './monitor-logic'
import { loopLanes } from './view-logic'

type LoopLanesProps = { items: BoardItem[]; agents: OfficeAgent[]; onSendToAgent(agentId: string): void }

export function LoopLanes({ items, agents, onSendToAgent }: LoopLanesProps): React.JSX.Element {
  const lanes = loopLanes(items)
  if (lanes.every((lane) => lane.items.length === 0)) {
    return <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-small text-muted-foreground">ยังไม่มีการ์ดที่ Loop รับไปในตัวกรองนี้</p>
  }
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-start gap-3">
        {lanes.map((lane) => (
          <section
            key={lane.stage}
            aria-labelledby={`lane-${lane.stage}`}
            className={cn('flex flex-col gap-2 rounded-lg bg-muted/50 p-3', lane.items.length === 0 ? 'w-32 shrink-0' : 'min-w-68 flex-1')}
          >
            <header className="flex items-center gap-2">
              <h2 id={`lane-${lane.stage}`} className="text-body-strong">{lane.label}</h2>
              <span className="text-caption text-muted-foreground tabular-nums">{lane.items.length}</span>
            </header>
            <ul className="flex flex-col gap-2">
              {lane.items.map((item) => (
                <QuestCardView key={item.card.id} item={item} agents={agents} onSendToAgent={onSendToAgent} framed />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
