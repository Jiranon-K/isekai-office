import type { OfficeAgent } from '@shared/types'
import { Button } from '@/components/ui/button'
import { longestWaiting } from './next-waiting-logic'

type NextWaitingButtonProps = { agents: readonly OfficeAgent[]; readOnly: boolean; onPick(agentId: string): void }

const READ_ONLY_REASON = 'โหมดอ่านอย่างเดียว ตอบจากห้องไม่ได้'

export function NextWaitingButton({ agents, readOnly, onPick }: NextWaitingButtonProps): React.JSX.Element {
  const target = longestWaiting(agents)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" size="sm" disabled={target === null || readOnly} onClick={() => target && onPick(target.id)}>
        {target === null ? 'ไม่มีงานรอ' : 'คนถัดไปที่รอ'}
      </Button>
      {readOnly ? <p className="text-small text-muted-foreground">{READ_ONLY_REASON}</p> : null}
    </div>
  )
}
