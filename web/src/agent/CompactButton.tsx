import type { OfficeAgent } from '@shared/types'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { canSendCompact, COMPACT_TEXT, isOverLoad } from '@/alerts/load-logic'
import { useCommand, type CommandStatus } from './use-command'

type CompactButtonProps = { agent: OfficeAgent; contextWindow: number }

const IDLE_ONLY_HINT = 'ส่งได้ตอน agent ว่างเท่านั้น'

function label(status: CommandStatus): React.ReactNode {
  if (status.kind === 'sending') {
    return <Spinner className="size-3" />
  }
  return status.kind === 'sent' ? 'ส่งแล้ว' : `ส่ง ${COMPACT_TEXT}`
}

export function CompactButton({ agent, contextWindow }: CompactButtonProps): React.JSX.Element | null {
  const command = useCommand(agent.id)
  if (!isOverLoad(agent, contextWindow)) {
    return null
  }
  const allowed = canSendCompact(agent)
  const busy = command.status.kind === 'sending' || command.status.kind === 'sent'
  return (
    <span className="flex shrink-0 items-center gap-1.5" title={allowed ? undefined : IDLE_ONLY_HINT}>
      {command.status.kind === 'failed' ? (
        <span role="alert" className="text-caption text-tint-red-fg">
          ส่งไม่สำเร็จ ({command.status.reason})
        </span>
      ) : null}
      <Button variant="outline" size="xs" disabled={!allowed || busy} onClick={() => void command.run('prompt', COMPACT_TEXT)}>
        {label(command.status)}
      </Button>
    </span>
  )
}
