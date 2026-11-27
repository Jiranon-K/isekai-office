import type { OfficeSnapshot } from '@shared/types'
import { Skeleton } from '@/components/ui/skeleton'
import { countAgents } from '@/lib/agent-counts'
import type { Loadable } from '@/lib/api'
import { cn } from '@/lib/utils'
import { QueueEntryButton } from '@/agent/QueueEntryButton'
import { rosterOrder } from './panel-data'
import { SessionList } from './SessionList'

type RosterPanelProps = { office: Loadable<OfficeSnapshot>; quiet: ReadonlyMap<string, number>; onSelect(agentId: string): void }

function Count({ label, value, emphasised = false }: { label: string; value: number; emphasised?: boolean }): React.JSX.Element {
  return (
    <div className={cn('flex flex-1 flex-col rounded-md bg-muted px-2 py-1.5', emphasised && 'bg-alert text-alert-foreground')}>
      <dd className="text-section-title tabular-nums">{value}</dd>
      <dt className={cn('text-caption', !emphasised && 'text-muted-foreground')}>{label}</dt>
    </div>
  )
}

function RosterSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="กำลังโหลดรายชื่อ session">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

export function RosterPanel({ office, quiet, onSelect }: RosterPanelProps): React.JSX.Element {
  if (!office.data) {
    return office.loading ? <RosterSkeleton /> : <p className="text-small text-muted-foreground">ยังอ่านรายชื่อ session ไม่ได้</p>
  }
  const counts = countAgents(office.data.agents)
  return (
    <>
      <dl className="flex gap-2">
        <Count label="จำนวน session" value={counts.total} />
        <Count label="กำลังทำงาน" value={counts.working} />
        <Count label="รอคุณ" value={counts.needsYou} emphasised={counts.needsYou > 0} />
      </dl>
      <QueueEntryButton />
      <SessionList agents={rosterOrder(office.data.agents)} empty="ยังไม่มี session" quiet={quiet} onSelect={onSelect} />
    </>
  )
}
