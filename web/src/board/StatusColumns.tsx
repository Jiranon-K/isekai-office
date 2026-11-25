import type { BoardColumn, OfficeAgent } from '@shared/types'
import { EmptyState } from '@/components/empty-state'
import { BoardIcon, RefreshIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { COLUMN_ORDER, COLUMN_TITLES, groupByColumn } from './board-logic'
import type { BoardItem } from './monitor-logic'
import { QuestCardView } from './QuestCardView'

type StatusColumnsProps = { items: BoardItem[]; empty: boolean; agents: OfficeAgent[]; onSendToAgent(agentId: string): void; onRefresh(): void }

const COLUMN_TONES: Record<BoardColumn, string> = {
  todo: 'bg-status-backlog',
  doing: 'bg-status-in-progress',
  review: 'bg-tint-violet-fg',
  done: 'bg-status-done'
}

type ColumnViewProps = { column: BoardColumn; items: BoardItem[]; agents: OfficeAgent[]; onSendToAgent(agentId: string): void }

function ColumnView({ column, items, agents, onSendToAgent }: ColumnViewProps): React.JSX.Element {
  return (
    <section aria-labelledby={`column-${column}`} className="flex min-w-0 flex-col gap-2 rounded-lg bg-muted/50 p-3">
      <header className="flex items-center gap-2">
        <span aria-hidden="true" className={cn('h-4 w-1 rounded-full', COLUMN_TONES[column])} />
        <h2 id={`column-${column}`} className="text-body-strong">{COLUMN_TITLES[column]}</h2>
        <span className="text-caption text-muted-foreground tabular-nums">{items.length}</span>
      </header>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-small text-muted-foreground">ยังไม่มี quest ในช่องนี้</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <QuestCardView key={item.card.id} item={item} agents={agents} onSendToAgent={onSendToAgent} framed />
          ))}
        </ul>
      )}
    </section>
  )
}

export function StatusColumns({ items, empty, agents, onSendToAgent, onRefresh }: StatusColumnsProps): React.JSX.Element {
  if (empty) {
    return (
      <EmptyState title="ยังไม่มี quest บน board" description="card ที่มอบหมายให้คุณใน Workspace จะมาแสดงที่นี่" icon={<BoardIcon className="size-6" />}>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshIcon />
          โหลดใหม่
        </Button>
      </EmptyState>
    )
  }
  const columns = groupByColumn(items)
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {COLUMN_ORDER.map((column) => (
        <ColumnView key={column} column={column} items={columns[column]} agents={agents} onSendToAgent={onSendToAgent} />
      ))}
    </div>
  )
}
