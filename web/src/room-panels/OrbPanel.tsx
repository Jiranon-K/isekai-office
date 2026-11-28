import { useMemo, useState } from 'react'
import type { FileConflict } from '@shared/conflicts'
import type { HandoffDraft } from '@shared/handoff'
import type { OfficeAgent } from '@shared/types'
import { isOverLoad } from '@/alerts/load-logic'
import { CompactButton } from '@/agent/CompactButton'
import { HandoffButton, HandoffCopyFallback } from '@/agent/HandoffButton'
import { formatContextLoad, needsDecision, STATE_LABELS } from '@/agent/panel-logic'
import { Badge } from '@/components/badge'
import { AlertIcon, RefreshIcon } from '@/components/icons'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { manaLevel, type ManaLevel } from '@/office/scene/mana'
import { classifyConflictView, conflictTabLabel, resolveConflictAgents } from './conflict-logic'
import { loadRows, type LoadRow } from './panel-data'
import { PanelNote } from './SessionList'
import type { ConflictsState } from './use-conflicts'

type OrbPanelProps = {
  agents: OfficeAgent[]
  contextWindow: number
  conflicts: ConflictsState
  onSelect(agentId: string): void
  onHandoff(draft: HandoffDraft): void
}

const LEVEL_TONES: Record<ManaLevel, string> = {
  low: 'bg-tint-blue-fg',
  warn: 'bg-tint-amber-fg',
  high: 'bg-tint-red-fg'
}

function LoadBar({ ratio }: { ratio: number }): React.JSX.Element {
  const percent = Math.round(ratio * 100)
  return (
    <span role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="context load" className="block h-1.5 overflow-hidden rounded-full bg-muted">
      <span className={cn('block h-full rounded-full', LEVEL_TONES[manaLevel(ratio)])} style={{ width: `${percent}%` }} />
    </span>
  )
}

type LoadItemProps = {
  row: LoadRow
  contextWindow: number
  onSelect(agentId: string): void
  onHandoff(draft: HandoffDraft): void
}

function LoadItem({ row, contextWindow, onSelect, onHandoff }: LoadItemProps): React.JSX.Element {
  const { agent, ratio } = row
  const [fallbackPrompt, setFallbackPrompt] = useState<string | null>(null)
  const overloaded = isOverLoad(agent, contextWindow)
  return (
    <li className="flex flex-col rounded-md">
      <div className="flex items-center gap-1 rounded-md pr-2 transition-colors duration-fast hover:bg-accent hover:text-accent-foreground motion-reduce:transition-none">
        <button
          type="button"
          onClick={() => onSelect(agent.id)}
          className="focus-ring flex min-w-0 flex-1 flex-col gap-1 rounded-md px-2 py-1.5 text-left"
        >
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-small font-medium">{agent.title}</span>
            <span className="font-mono text-caption text-muted-foreground">{formatContextLoad(agent.contextTokens, contextWindow) ?? 'ไม่ทราบ'}</span>
          </span>
          {ratio === null ? null : <LoadBar ratio={ratio} />}
        </button>
        <CompactButton agent={agent} contextWindow={contextWindow} />
        {overloaded ? <HandoffButton agent={agent} onHandoff={onHandoff} onManualCopy={setFallbackPrompt} /> : null}
      </div>
      {fallbackPrompt !== null ? <HandoffCopyFallback prompt={fallbackPrompt} onClose={() => setFallbackPrompt(null)} /> : null}
    </li>
  )
}

function ConflictRow({
  conflict,
  agentsById,
  onSelect
}: {
  conflict: FileConflict
  agentsById: ReadonlyMap<string, OfficeAgent>
  onSelect(agentId: string): void
}): React.JSX.Element {
  const members = resolveConflictAgents(conflict, agentsById)
  return (
    <li className="flex flex-col gap-1.5 rounded-md border bg-muted/40 p-2">
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate text-caption" title={conflict.path}>
          {conflict.path}
        </code>
        <Badge variant="outline" className="shrink-0 font-mono">
          {conflict.repo}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {members.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => onSelect(agent.id)}
            className="focus-ring inline-flex max-w-full items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-left text-caption transition-colors duration-fast hover:bg-accent hover:text-accent-foreground motion-reduce:transition-none"
          >
            <span className="truncate font-medium">{agent.title}</span>
            <Badge variant={needsDecision(agent.state) ? 'amber' : 'muted'}>{STATE_LABELS[agent.state]}</Badge>
          </button>
        ))}
      </div>
    </li>
  )
}

function ConflictsTab({
  agents,
  conflicts,
  onSelect
}: {
  agents: OfficeAgent[]
  conflicts: ConflictsState
  onSelect(agentId: string): void
}): React.JSX.Element {
  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents])
  const view = classifyConflictView(conflicts.conflicts, conflicts.loading, conflicts.error)

  if (view === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 rounded-md bg-tint-red-bg p-3 text-small text-tint-red-fg">
        <span className="flex items-center gap-1.5 text-body-strong">
          <AlertIcon />
          ตรวจไฟล์ชนกันไม่ได้
        </span>
        <Button type="button" variant="outline" size="sm" onClick={conflicts.refresh}>
          <RefreshIcon />
          ลองใหม่
        </Button>
      </div>
    )
  }
  if (view === 'loading') {
    return (
      <div role="status" aria-label="กำลังตรวจไฟล์ชนกัน" className="flex justify-center py-4">
        <Spinner />
      </div>
    )
  }
  if (view === 'empty') {
    return <PanelNote>ยังไม่พบไฟล์ที่ agent แก้ชนกัน</PanelNote>
  }
  return (
    <ul aria-label="ไฟล์ชนกัน" className="flex flex-col gap-2">
      {conflicts.conflicts.map((conflict) => (
        <ConflictRow key={`${conflict.repo}:${conflict.path}`} conflict={conflict} agentsById={agentsById} onSelect={onSelect} />
      ))}
    </ul>
  )
}

export function OrbPanel({ agents, contextWindow, conflicts, onSelect, onHandoff }: OrbPanelProps): React.JSX.Element {
  return (
    <Tabs defaultValue="load" className="gap-3">
      <TabsList aria-label="ลูกแก้ว" className="w-full">
        <TabsTrigger value="load">โหลด context</TabsTrigger>
        <TabsTrigger value="conflicts">{conflictTabLabel(conflicts.conflicts.length)}</TabsTrigger>
      </TabsList>
      <TabsContent value="load">
        {agents.length === 0 ? (
          <PanelNote>ยังไม่มี session ให้วัด context</PanelNote>
        ) : (
          <ul className="flex flex-col gap-1">
            {loadRows(agents, contextWindow).map((row) => (
              <LoadItem key={row.agent.id} row={row} contextWindow={contextWindow} onSelect={onSelect} onHandoff={onHandoff} />
            ))}
          </ul>
        )}
      </TabsContent>
      <TabsContent value="conflicts">
        <ConflictsTab agents={agents} conflicts={conflicts} onSelect={onSelect} />
      </TabsContent>
    </Tabs>
  )
}
