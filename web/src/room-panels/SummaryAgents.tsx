import { cn } from '@/lib/utils'
import { formatDuration } from './summary-format'
import type { AgentDay } from './summary-logic'

type SummaryAgentsProps = { agents: readonly AgentDay[]; present: ReadonlySet<string>; onSelect(agentId: string): void }

const ROW_CLASS = 'grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-2 rounded-md px-2 py-1 text-left text-small'

function Cells({ agent }: { agent: AgentDay }): React.JSX.Element {
  return (
    <>
      <span className="min-w-0 truncate">{agent.title}</span>
      <span className="tabular-nums text-muted-foreground">{formatDuration(agent.workingMs)}</span>
      <span className="tabular-nums">{formatDuration(agent.waitingMs)}</span>
      <span className="tabular-nums text-muted-foreground">{agent.waits}</span>
    </>
  )
}

function AgentRow({ agent, inRoom, onSelect }: { agent: AgentDay; inRoom: boolean; onSelect(agentId: string): void }): React.JSX.Element {
  if (!inRoom) {
    return (
      <li className={ROW_CLASS}>
        <Cells agent={agent} />
      </li>
    )
  }
  return (
    <li>
      <button type="button" onClick={() => onSelect(agent.agentId)} className={cn(ROW_CLASS, 'focus-ring w-full transition-colors duration-fast hover:bg-accent hover:text-accent-foreground')}>
        <Cells agent={agent} />
      </button>
    </li>
  )
}

export function SummaryAgents({ agents, present, onSelect }: SummaryAgentsProps): React.JSX.Element {
  return (
    <section aria-label="session ของวัน" className="flex flex-col gap-0.5">
      <div className={cn(ROW_CLASS, 'text-caption text-muted-foreground')}>
        <span>session</span>
        <span>ทำงาน</span>
        <span>รอ</span>
        <span>ครั้ง</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {agents.map((agent) => (
          <AgentRow key={agent.agentId} agent={agent} inRoom={present.has(agent.agentId)} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  )
}
