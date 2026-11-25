import type { OfficeAgent, QuestCard } from '@shared/types'
import { Badge } from '@/components/badge'
import { AgentIcon, ExternalLinkIcon, MergeIcon } from '@/components/icons'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { isHighPriority, loopStageLabel, visibleLabels } from './board-logic'
import { AgentChip } from './AgentChip'
import type { BoardItem } from './monitor-logic'
import { SendToClaude } from './SendToClaude'
import { nextStep, spaceTone, type NextStep } from './view-logic'

type QuestCardViewProps = {
  item: BoardItem
  agents: OfficeAgent[]
  onSendToAgent(agentId: string): void
  framed?: boolean
}

function CardBadges({ card }: { card: QuestCard }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant={spaceTone(card.space)}>{card.space}</Badge>
      {card.loop ? (
        <Badge variant="teal" title={card.loop.status}>
          {loopStageLabel(card.loop.status)}
        </Badge>
      ) : null}
      {isHighPriority(card.priority) ? <Badge variant="red">{card.priority}</Badge> : null}
      {card.sprint ? <Badge variant="muted">{card.sprint}</Badge> : null}
      {visibleLabels(card.labels).map((label) => (
        <Badge key={label} variant="outline">
          {label}
        </Badge>
      ))}
    </div>
  )
}

function StepIcon({ step }: { step: NextStep }): React.JSX.Element {
  if (step.agentId) {
    return <AgentIcon />
  }
  return step.label === 'เปิด MR' ? <MergeIcon /> : <ExternalLinkIcon />
}

function StepAction({ step, primary, onSendToAgent }: { step: NextStep; primary: boolean; onSendToAgent(agentId: string): void }): React.JSX.Element | null {
  const variant = primary ? 'default' : 'outline'
  const { agentId, href } = step
  if (agentId) {
    return (
      <Button variant={variant} size="sm" onClick={() => onSendToAgent(agentId)}>
        <StepIcon step={step} />
        {step.label}
      </Button>
    )
  }
  if (!href) {
    return null
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant, size: 'sm' }))}>
      <StepIcon step={step} />
      {step.label}
    </a>
  )
}

export function QuestCardView({ item, agents, onSendToAgent, framed = false }: QuestCardViewProps): React.JSX.Element {
  const { card, agent, reason } = item
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5',
        framed ? 'rounded-md border border-border bg-card text-card-foreground' : 'border-t border-border first:border-t-0'
      )}
    >
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <a href={card.url} target="_blank" rel="noopener noreferrer" aria-label={`เปิด ${card.key ?? 'การ์ด'} ใน Workspace`} className="focus-ring shrink-0 rounded-sm text-issue-key text-primary underline-offset-4 hover:underline">
            {card.key ?? 'ไม่มี key'}
          </a>
          <h3 className="line-clamp-2 min-w-0 text-body-strong">{card.title}</h3>
        </div>
        <CardBadges card={card} />
        {agent ? <AgentChip agent={agent} onOpen={onSendToAgent} /> : null}
        {card.assignee ? <p className="text-caption text-muted-foreground">{card.assignee}</p> : null}
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <StepAction step={nextStep(item)} primary={reason !== null} onSendToAgent={onSendToAgent} />
        <SendToClaude card={card} agents={agents} onSendToAgent={onSendToAgent} />
      </div>
    </li>
  )
}
