import type { OfficeAgent } from '@shared/types'
import { Badge } from '@/components/badge'
import { needsDecision, STATE_LABELS } from '@/agent/panel-logic'

type SessionListProps = {
  agents: OfficeAgent[]
  empty: string
  quiet?: ReadonlyMap<string, number>
  onSelect(agentId: string): void
  detail?(agent: OfficeAgent): React.ReactNode
}

export function PanelNote({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-small text-muted-foreground">{children}</p>
}

function StateBadge({ agent }: { agent: OfficeAgent }): React.JSX.Element {
  return <Badge variant={needsDecision(agent.state) ? 'amber' : 'muted'}>{STATE_LABELS[agent.state]}</Badge>
}

function QuietBadge({ minutes }: { minutes: number | undefined }): React.JSX.Element | null {
  return minutes === undefined ? null : <Badge variant="blue">เงียบ {minutes} นาที</Badge>
}

export function SessionList({ agents, empty, quiet, onSelect, detail }: SessionListProps): React.JSX.Element {
  if (agents.length === 0) {
    return <PanelNote>{empty}</PanelNote>
  }
  return (
    <ul className="flex flex-col gap-1">
      {agents.map((agent) => (
        <li key={agent.id}>
          <button
            type="button"
            onClick={() => onSelect(agent.id)}
            className="focus-ring flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left transition-colors duration-fast hover:bg-accent hover:text-accent-foreground motion-reduce:transition-none"
          >
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-small font-medium">{agent.title}</span>
              <QuietBadge minutes={quiet?.get(agent.id)} />
              <StateBadge agent={agent} />
            </span>
            {detail ? detail(agent) : agent.repo ? <span className="truncate text-caption text-muted-foreground">{agent.repo}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  )
}
