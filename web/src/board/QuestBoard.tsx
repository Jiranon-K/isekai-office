import type { BoardSnapshot, OfficeAgent } from '@shared/types'
import { RefreshIcon, XIcon } from '@/components/icons'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Loadable } from '@/lib/api'
import { useSourceCaps } from '@/lib/source-caps'
import { BoardError } from './BoardError'
import { BoardFilters } from './BoardFilters'
import { BoardSearch } from './BoardSearch'
import { COLUMN_ORDER } from './board-logic'
import { LoopLanes } from './LoopLanes'
import { boardView, filterOptions } from './monitor-logic'
import { NextWaitingButton } from './NextWaitingButton'
import { ReleaseChecklist } from './ReleaseChecklist'
import { StatusColumns } from './StatusColumns'
import { useBoardQuery } from './use-board-query'
import { BOARD_TABS, filteredItems, searchItems, TAB_LABELS, type BoardQuery, type BoardTab } from './view-logic'
import { WaitingLane } from './WaitingLane'

type QuestBoardProps = {
  board: Loadable<BoardSnapshot> & { refresh(): void }
  agents: OfficeAgent[]
  onSendToAgent(agentId: string): void
  onClose(): void
}

function formatUpdatedAt(at: number): string {
  return new Date(at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function SkeletonColumns(): React.JSX.Element {
  return (
    <div role="status" aria-label="กำลังโหลด Quest Board" className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {COLUMN_ORDER.map((column) => (
        <div key={column} className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ))}
    </div>
  )
}

type LoadedProps = QuestBoardProps & { snapshot: BoardSnapshot; query: BoardQuery; onTabChange(tab: BoardTab): void }

function Loaded({ board, snapshot, query, agents, onSendToAgent, onClose, onTabChange }: LoadedProps): React.JSX.Element {
  const caps = useSourceCaps()
  const view = boardView(snapshot, agents, query.filter)
  const waiting = searchItems(view.waiting, query.search)
  const items = searchItems(filteredItems(snapshot, agents, query.filter), query.search)
  const rounds = view.rounds.map((round) => ({ ...round, rows: round.rows.filter((row) => searchItems([row.item], query.search).length > 0) }))
  const counts: Record<BoardTab, number> = {
    inbox: waiting.length,
    loop: items.filter((item) => item.card.loop !== null).length,
    release: rounds.reduce((total, round) => total + round.rows.length, 0),
    all: items.length
  }
  return (
    <Tabs value={query.tab} onValueChange={(value) => onTabChange(BOARD_TABS.find((tab) => tab === value) ?? 'inbox')} className="gap-4">
      <TabsList variant="line" aria-label="มุมมองของ Quest Board" className="border-b border-border">
        {BOARD_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="flex-none">
            {TAB_LABELS[tab]}
            <span className="text-caption tabular-nums">{counts[tab]}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {board.error ? <BoardError error={board.error} onRetry={board.refresh} /> : null}
      <TabsContent value="inbox">
        <NextWaitingButton
          agents={agents}
          readOnly={!caps.command}
          onPick={(agentId) => {
            onSendToAgent(agentId)
            onClose()
          }}
        />
        <WaitingLane items={waiting} agents={agents} onSendToAgent={onSendToAgent} />
      </TabsContent>
      <TabsContent value="loop">
        <LoopLanes items={items} agents={agents} onSendToAgent={onSendToAgent} />
      </TabsContent>
      <TabsContent value="release">
        <ReleaseChecklist rounds={rounds} onSendToAgent={onSendToAgent} />
      </TabsContent>
      <TabsContent value="all">
        <StatusColumns items={items} empty={snapshot.cards.length === 0} agents={agents} onSendToAgent={onSendToAgent} onRefresh={board.refresh} />
      </TabsContent>
    </Tabs>
  )
}

function Content(props: QuestBoardProps & { query: BoardQuery; onTabChange(tab: BoardTab): void }): React.JSX.Element {
  const { board } = props
  if (board.error && (board.data?.cards.length ?? 0) === 0) {
    return <BoardError error={board.error} onRetry={board.refresh} />
  }
  if (!board.data) {
    return <SkeletonColumns />
  }
  return <Loaded {...props} snapshot={board.data} />
}

export function QuestBoard(props: QuestBoardProps): React.JSX.Element {
  const { board } = props
  const [query, setQuery] = useBoardQuery()
  return (
    <main className="absolute inset-0 overflow-y-auto bg-background/95 px-3 pb-6 pt-3 sm:px-6">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-section-title">Quest Board</h2>
          {board.data ? (
            <span className="text-small text-muted-foreground">อัปเดตล่าสุด {formatUpdatedAt(board.data.at)}</span>
          ) : null}
          <BoardSearch value={query.search} onChange={(search) => setQuery({ ...query, search })} />
          {board.data ? <BoardFilters filter={query.filter} options={filterOptions(board.data)} onChange={(filter) => setQuery({ ...query, filter })} /> : null}
          <Button variant="outline" size="sm" className="ml-auto" onClick={board.refresh} disabled={board.loading} aria-label="โหลด Quest Board ใหม่">
            {board.loading ? <Spinner /> : <RefreshIcon />}
            รีเฟรช
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="ปิด Quest Board กลับไปที่ห้อง" onClick={props.onClose}>
            <XIcon />
          </Button>
        </div>
        <Content {...props} query={query} onTabChange={(tab) => setQuery({ ...query, tab })} />
      </div>
    </main>
  )
}
