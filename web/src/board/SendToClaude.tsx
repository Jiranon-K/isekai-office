import type { OfficeAgent, QuestCard } from '@shared/types'
import { useState } from 'react'
import { AgentIcon } from '@/components/icons'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { sendCommand } from '@/lib/api'
import { describeResult, STATE_LABELS } from '@/agent/panel-logic'
import { loopStartPrompt, sendableAgents } from './board-logic'

type SendStatus = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; agentTitle: string } | { kind: 'failed'; reason: string }

type SendToClaudeProps = {
  card: QuestCard
  agents: OfficeAgent[]
  onSendToAgent(agentId: string): void
}

function disabledReason(card: QuestCard, candidates: OfficeAgent[]): string | null {
  if (card.key === null) {
    return 'card นี้ไม่มี key จึงสั่ง /jk-loop:start ไม่ได้'
  }
  if (candidates.length === 0) {
    return 'ไม่มี session ที่มี terminal ให้ส่งคำสั่ง'
  }
  return null
}

function StatusLine({ status }: { status: SendStatus }): React.JSX.Element | null {
  if (status.kind === 'sent') {
    return <p role="status" className="text-caption text-tint-green-fg">ส่งให้ {status.agentTitle} แล้ว</p>
  }
  if (status.kind === 'failed') {
    return <p role="alert" className="text-caption text-tint-red-fg">ส่งไม่สำเร็จ ({status.reason}) ลองใหม่อีกครั้ง</p>
  }
  return null
}

export function SendToClaude({ card, agents, onSendToAgent }: SendToClaudeProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<SendStatus>({ kind: 'idle' })
  const candidates = sendableAgents(agents)
  const reason = disabledReason(card, candidates)
  const sending = status.kind === 'sending'

  async function sendTo(agent: OfficeAgent): Promise<void> {
    if (card.key === null) {
      return
    }
    setStatus({ kind: 'sending' })
    try {
      const result = await sendCommand({ agentId: agent.id, action: 'prompt', text: loopStartPrompt(card.key) })
      const failure = describeResult(result)
      if (failure) {
        setStatus({ kind: 'failed', reason: failure })
        return
      }
      setStatus({ kind: 'sent', agentTitle: agent.title })
      setOpen(false)
      onSendToAgent(agent.id)
    } catch {
      setStatus({ kind: 'failed', reason: 'server_unreachable' })
    }
  }

  if (reason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="focus-ring inline-flex rounded-md">
            <Button variant="outline" size="sm" disabled aria-label={`ส่งให้ Claude (${reason})`}>
              <AgentIcon />
              ส่งให้ Claude
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" disabled={sending}>
            {sending ? <Spinner /> : <AgentIcon />}
            ส่งให้ Claude
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-72 flex-col gap-1 p-1.5">
          <p className="px-2 py-1 text-caption text-muted-foreground">เลือก session ที่จะรับ /jk-loop:start {card.key}</p>
          {candidates.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => void sendTo(agent)}
              className="focus-ring flex min-h-10 flex-col items-start rounded-md px-2 py-1.5 text-left transition-colors duration-fast hover:bg-accent motion-reduce:transition-none"
            >
              <span className="w-full truncate text-small font-medium">{agent.title}</span>
              <span className="w-full truncate text-caption text-muted-foreground">
                {agent.repo ?? 'ไม่ระบุ repo'} ({STATE_LABELS[agent.state]})
              </span>
            </button>
          ))}
        </PopoverContent>
      </Popover>
      <StatusLine status={status} />
    </div>
  )
}
