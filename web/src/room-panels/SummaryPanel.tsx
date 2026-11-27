import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useLogDays } from '@/replay/replay-api'
import { SummaryBody } from './SummaryBody'
import { PanelNote } from './SessionList'
import { summaryDayOptions } from './summary-days'
import { useDaySummary } from './use-day-summary'

type SummaryPanelProps = { present: ReadonlySet<string>; onSelect(agentId: string): void }

export function SummaryPanel({ present, onSelect }: SummaryPanelProps): React.JSX.Element {
  const options = summaryDayOptions(useLogDays(true).data?.days ?? [])
  const [date, setDate] = useState(options[0]?.date ?? '')
  const ledgerDay = options.find((option) => option.date === date)?.ledgerDay ?? date
  const summary = useDaySummary(date, ledgerDay)
  return (
    <div className="flex flex-col gap-3">
      <ul aria-label="เลือกวัน" className="flex flex-wrap gap-1">
        {options.map((option) => (
          <li key={option.date}>
            <Button type="button" size="xs" variant={option.date === date ? 'default' : 'outline'} aria-pressed={option.date === date} onClick={() => setDate(option.date)}>
              {option.label}
            </Button>
          </li>
        ))}
      </ul>
      {summary.loading ? <Skeleton className="h-24 w-full" /> : null}
      {summary.error ? <PanelNote>อ่านข้อมูลของวันนั้นไม่ได้</PanelNote> : null}
      {summary.data ? <SummaryBody summary={summary.data} present={present} onSelect={onSelect} /> : null}
    </div>
  )
}
