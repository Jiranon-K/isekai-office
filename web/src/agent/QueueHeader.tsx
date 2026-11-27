import type { OfficeAgent } from '@shared/types'
import { Badge } from '@/components/badge'
import { XIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { waitText } from '@/room-panels/log-logic'
import { STATE_LABELS } from './panel-logic'

type QueueHeaderProps = { agent: OfficeAgent; position: number; total: number; now: number; onClose(): void }

export function QueueHeader({ agent, position, total, now, onClose }: QueueHeaderProps): React.JSX.Element {
  return (
    <header className="flex items-start gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="truncate text-body-strong">{agent.title}</h2>
        {agent.repo ? <p className="truncate text-caption text-muted-foreground">{agent.repo}</p> : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="amber">{STATE_LABELS[agent.state]}</Badge>
          <span className="text-caption text-muted-foreground">{waitText(Math.max(0, now - agent.updatedAt))}</span>
        </div>
      </div>
      <span className="text-small tabular-nums text-muted-foreground" aria-label={`คิวที่ ${position} จาก ${total}`}>
        {position} / {total}
      </span>
      <Button variant="ghost" size="icon-sm" aria-label="ปิดการ์ดตอบทีละคน" onClick={onClose}>
        <XIcon />
      </Button>
    </header>
  )
}
