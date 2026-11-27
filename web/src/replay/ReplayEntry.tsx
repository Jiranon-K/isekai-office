import { createContext, useContext } from 'react'
import { Button } from '@/components/ui/button'
import { localDateOf } from './replay-format'
import { useLogDays } from './replay-api'

export type ReplayEntryValue = { date: string | null; enter(date: string): void }

const ReplayEntryContext = createContext<ReplayEntryValue | null>(null)

export const ReplayEntryProvider = ReplayEntryContext.Provider

function DayButton({ date, current, onPick }: { date: string; current: boolean; onPick(date: string): void }): React.JSX.Element {
  return (
    <li>
      <Button type="button" size="xs" variant={current ? 'default' : 'outline'} aria-pressed={current} onClick={() => onPick(date)}>
        {date}
      </Button>
    </li>
  )
}

export function ReplayEntry(): React.JSX.Element | null {
  const entry = useContext(ReplayEntryContext)
  const days = useLogDays(entry !== null)
  if (entry === null) {
    return null
  }
  const today = localDateOf(Date.now())
  const earlier = (days.data?.days ?? []).filter((date) => date !== today)
  return (
    <section aria-label="ย้อนดู" className="flex flex-col gap-2">
      <Button type="button" variant="outline" onClick={() => entry.enter(today)}>
        ย้อนดูวันนี้
      </Button>
      {earlier.length > 0 ? (
        <ul aria-label="วันที่ย้อนดูได้" className="flex flex-wrap gap-1">
          {earlier.map((date) => (
            <DayButton key={date} date={date} current={entry.date === date} onPick={entry.enter} />
          ))}
        </ul>
      ) : null}
    </section>
  )
}
