import { formatGold } from '@/ledger/ledger-logic'
import { SummaryAgents } from './SummaryAgents'
import { SummaryCopyButton } from './SummaryCopyButton'
import { busiestHourText, EMPTY_DAY_NOTE, formatDuration, isEmptyDay, longestWaitText, medianText, watchedNote } from './summary-format'
import type { DaySummary } from './summary-logic'
import { PanelNote } from './SessionList'

type SummaryBodyProps = { summary: DaySummary; present: ReadonlySet<string>; onSelect(agentId: string): void }

function Figure({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col rounded-md bg-muted px-2 py-1.5">
      <dd className="text-section-title tabular-nums">{value}</dd>
      <dt className="text-caption text-muted-foreground">{label}</dt>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string | null }): React.JSX.Element | null {
  if (value === null) {
    return null
  }
  return (
    <p className="text-small">
      <span className="text-muted-foreground">{label} </span>
      {value}
    </p>
  )
}

function spendText(summary: DaySummary): string | null {
  return summary.spend ? formatGold(summary.spend.amount) : null
}

export function SummaryBody({ summary, present, onSelect }: SummaryBodyProps): React.JSX.Element {
  if (isEmptyDay(summary)) {
    return <PanelNote>{EMPTY_DAY_NOTE}</PanelNote>
  }
  return (
    <>
      <dl className="grid grid-cols-2 gap-2">
        <Figure label="session" value={String(summary.sessions)} />
        <Figure label="เสร็จแล้ว" value={String(summary.finished)} />
        <Figure label="รอรวม" value={formatDuration(summary.waitingMs)} />
        <Figure label="รอนานที่สุด" value={summary.longestWait ? formatDuration(summary.longestWait.ms) : '-'} />
      </dl>
      <Line label="รอนานที่สุดคือ" value={longestWaitText(summary)} />
      <Line label="รอครั้งกลาง" value={medianText(summary)} />
      <Line label="ชั่วโมงที่ทำงานมากที่สุด" value={busiestHourText(summary)} />
      <Line label="ค่าใช้จ่าย" value={spendText(summary)} />
      <SummaryAgents agents={summary.agents} present={present} onSelect={onSelect} />
      <p className="text-caption text-muted-foreground">{watchedNote(summary.watchedMs)}</p>
      <SummaryCopyButton summary={summary} />
    </>
  )
}
