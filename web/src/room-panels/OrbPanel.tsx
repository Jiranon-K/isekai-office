import { useState } from 'react'
import type { HandoffDraft } from '@shared/handoff'
import type { OfficeAgent } from '@shared/types'
import { isOverLoad } from '@/alerts/load-logic'
import { CompactButton } from '@/agent/CompactButton'
import { HandoffButton, HandoffCopyFallback } from '@/agent/HandoffButton'
import { formatContextLoad } from '@/agent/panel-logic'
import { cn } from '@/lib/utils'
import { manaLevel, type ManaLevel } from '@/office/scene/mana'
import { loadRows, type LoadRow } from './panel-data'
import { PanelNote } from './SessionList'

type OrbPanelProps = {
  agents: OfficeAgent[]
  contextWindow: number
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

export function OrbPanel({ agents, contextWindow, onSelect, onHandoff }: OrbPanelProps): React.JSX.Element {
  if (agents.length === 0) {
    return <PanelNote>ยังไม่มี session ให้วัด context</PanelNote>
  }
  return (
    <ul className="flex flex-col gap-1">
      {loadRows(agents, contextWindow).map((row) => (
        <LoadItem key={row.agent.id} row={row} contextWindow={contextWindow} onSelect={onSelect} onHandoff={onHandoff} />
      ))}
    </ul>
  )
}
