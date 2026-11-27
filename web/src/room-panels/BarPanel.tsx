import type { BoardSnapshot, OfficeAgent } from '@shared/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LedgerPanel } from '@/ledger/LedgerPanel'
import { CardRows } from './CardRows'
import { cardsToVerify, doneSessions } from './panel-data'
import { SessionList } from './SessionList'

type BarPanelProps = { agents: OfficeAgent[]; board: BoardSnapshot | null; onSelect(agentId: string): void }

export function BarPanel({ agents, board, onSelect }: BarPanelProps): React.JSX.Element {
  const toVerify = cardsToVerify(board)
  return (
    <Tabs defaultValue="done" className="gap-3">
      <TabsList aria-label="ชั้นบาร์" className="w-full">
        <TabsTrigger value="done">เสร็จแล้ว</TabsTrigger>
        <TabsTrigger value="ledger">บิล</TabsTrigger>
      </TabsList>
      <TabsContent value="done" className="flex flex-col gap-3">
        <SessionList agents={doneSessions(agents)} empty="ยังไม่มี session ที่เสร็จ" onSelect={onSelect} />
        {toVerify.length > 0 ? (
          <section className="flex flex-col gap-1">
            <h3 className="text-caption text-muted-foreground">MR รอ verify</h3>
            <CardRows cards={toVerify} label="MR รอ verify" />
          </section>
        ) : null}
      </TabsContent>
      <TabsContent value="ledger">
        <LedgerPanel />
      </TabsContent>
    </Tabs>
  )
}
