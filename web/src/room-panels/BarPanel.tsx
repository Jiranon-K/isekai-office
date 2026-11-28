import { useEffect, useState } from 'react'
import type { DiffSummary } from '@shared/diff'
import type { BoardSnapshot, OfficeAgent } from '@shared/types'
import { formatDiffSummary, indexDiffSummaries, summaryIdsKey } from '@/agent/diff-logic'
import { Badge } from '@/components/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LedgerPanel } from '@/ledger/LedgerPanel'
import { fetchDiffSummaries } from '@/lib/api'
import { CardRows } from './CardRows'
import { cardsToVerify, doneSessions } from './panel-data'
import { SessionList } from './SessionList'

type BarPanelProps = { agents: OfficeAgent[]; board: BoardSnapshot | null; onSelect(agentId: string): void }

function useDoneDiffSummaries(done: readonly OfficeAgent[]): ReadonlyMap<string, DiffSummary> {
  const [summaries, setSummaries] = useState<ReadonlyMap<string, DiffSummary>>(() => new Map())
  const key = summaryIdsKey(done)

  useEffect(() => {
    if (key === '') {
      setSummaries(new Map())
      return
    }
    let active = true
    const ids = key.split(',')
    fetchDiffSummaries(ids)
      .then((response) => {
        if (active) {
          setSummaries(indexDiffSummaries(response.summaries))
        }
      })
      .catch(() => {
        if (active) {
          setSummaries(new Map())
        }
      })
    return () => {
      active = false
    }
  }, [key])

  return summaries
}

function DoneSessionDetail({ agent, summary }: { agent: OfficeAgent; summary: DiffSummary | undefined }): React.JSX.Element | null {
  const label = formatDiffSummary(summary)
  if (!agent.repo && !label) {
    return null
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
      {agent.repo ? <span className="truncate">{agent.repo}</span> : null}
      {label ? (
        <Badge variant="outline" className="h-4.5 px-1.5 font-mono">
          {label}
        </Badge>
      ) : null}
    </span>
  )
}

export function BarPanel({ agents, board, onSelect }: BarPanelProps): React.JSX.Element {
  const done = doneSessions(agents)
  const summaries = useDoneDiffSummaries(done)
  const toVerify = cardsToVerify(board)
  return (
    <Tabs defaultValue="done" className="gap-3">
      <TabsList aria-label="ชั้นบาร์" className="w-full">
        <TabsTrigger value="done">เสร็จแล้ว</TabsTrigger>
        <TabsTrigger value="ledger">บิล</TabsTrigger>
      </TabsList>
      <TabsContent value="done" className="flex flex-col gap-3">
        <SessionList
          agents={done}
          empty="ยังไม่มี session ที่เสร็จ"
          onSelect={onSelect}
          detail={(agent) => <DoneSessionDetail agent={agent} summary={summaries.get(agent.id)} />}
        />
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
