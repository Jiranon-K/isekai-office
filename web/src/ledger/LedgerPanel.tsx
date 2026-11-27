import { useState } from 'react'
import type { Ledger } from '@shared/ledger'
import { Button } from '@/components/ui/button'
import { PanelNote } from '@/room-panels/SessionList'
import { dateOfDay, formatGold, formatMoney, NO_PRICE_NOTE, unpricedNoteOf, type LedgerDay } from './ledger-logic'
import { LedgerRowItem } from './LedgerRowItem'
import { useLedger } from './use-ledger'

const DAY_LABELS: [LedgerDay, string][] = [
  ['today', 'วันนี้'],
  ['yesterday', 'เมื่อวาน']
]

function Total({ ledger }: { ledger: Ledger }): React.JSX.Element {
  if (ledger.total === null) {
    return <p className="text-small text-muted-foreground">ยังไม่มีราคา แสดงเฉพาะจำนวนโทเคน</p>
  }
  return (
    <p className="flex items-baseline gap-2">
      <span className="font-mono text-body-strong text-tint-amber-fg">{formatGold(ledger.total)}</span>
      <span className="font-mono text-caption text-muted-foreground">{formatMoney(ledger.total, ledger.currency)}</span>
    </p>
  )
}

function Body({ ledger }: { ledger: Ledger }): React.JSX.Element {
  const note = unpricedNoteOf(ledger)
  return (
    <>
      <Total ledger={ledger} />
      <p className="text-caption text-muted-foreground">{NO_PRICE_NOTE}</p>
      {note ? <p className="text-caption text-tint-amber-fg">{note}</p> : null}
      {ledger.rows.length === 0 ? (
        <PanelNote>ยังไม่มีการใช้โทเคนในวันนั้น</PanelNote>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {ledger.rows.map((row) => (
            <LedgerRowItem key={`${row.session}:${row.model}`} row={row} currency={ledger.currency} />
          ))}
        </ul>
      )}
    </>
  )
}

export function LedgerPanel(): React.JSX.Element {
  const [day, setDay] = useState<LedgerDay>('today')
  const ledger = useLedger(dateOfDay(day))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        {DAY_LABELS.map(([value, label]) => (
          <Button key={value} size="sm" variant={day === value ? 'secondary' : 'ghost'} aria-pressed={day === value} onClick={() => setDay(value)}>
            {label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" className="ml-auto" disabled={ledger.loading} onClick={ledger.refresh}>
          รีเฟรช
        </Button>
      </div>
      {ledger.error && !ledger.data ? <PanelNote>อ่านบิลไม่ได้ ลองรีเฟรชอีกครั้ง</PanelNote> : null}
      {ledger.data ? <Body ledger={ledger.data} /> : null}
    </div>
  )
}
