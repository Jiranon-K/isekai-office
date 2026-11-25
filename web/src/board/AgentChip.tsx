import type { AgentState, OfficeAgent } from '@shared/types'
import { AgentIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { STATE_LABELS } from '@/agent/panel-logic'
import { formatTokenCount } from './board-logic'

type AgentChipProps = { agent: OfficeAgent; onOpen(agentId: string): void }

const STATE_TONES: Record<AgentState, string> = {
  working: 'bg-tint-teal-bg text-tint-teal-fg',
  waiting: 'bg-tint-amber-bg text-tint-amber-fg',
  blocked: 'bg-tint-red-bg text-tint-red-fg',
  done: 'bg-muted text-foreground'
}

export function AgentChip({ agent, onOpen }: AgentChipProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onOpen(agent.id)}
      aria-label={`เปิด command panel ของ ${agent.title}`}
      className={cn(
        'focus-ring inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-sm px-2 text-caption transition-colors duration-fast motion-reduce:transition-none',
        STATE_TONES[agent.state]
      )}
    >
      <AgentIcon className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{agent.title}</span>
      <span className="shrink-0">{STATE_LABELS[agent.state]}</span>
      {agent.contextTokens !== null ? <span className="shrink-0 tabular-nums">{formatTokenCount(agent.contextTokens)}</span> : null}
    </button>
  )
}
