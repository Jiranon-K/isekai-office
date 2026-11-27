import { sumTokens, type LedgerRow } from '@shared/ledger'
import { formatGold, formatMoney, formatTokenCount, tokenBreakdown } from './ledger-logic'

type LedgerRowItemProps = { row: LedgerRow; currency: string | null }

function CostCell({ row, currency }: LedgerRowItemProps): React.JSX.Element {
  if (row.cost === null) {
    return <span className="font-mono text-small text-muted-foreground">{formatTokenCount(sumTokens(row.tokens))} โทเคน</span>
  }
  return (
    <span className="flex flex-col items-end">
      <span className="font-mono text-small text-tint-amber-fg">{formatGold(row.cost)}</span>
      <span className="font-mono text-caption text-muted-foreground">{formatMoney(row.cost, currency)}</span>
    </span>
  )
}

export function LedgerRowItem({ row, currency }: LedgerRowItemProps): React.JSX.Element {
  return (
    <li title={tokenBreakdown(row.tokens)} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent hover:text-accent-foreground">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-small font-medium">{row.title}</span>
        <span className="truncate text-caption text-muted-foreground">{row.model ?? 'ไม่ทราบโมเดล'}</span>
      </span>
      <CostCell row={row} currency={currency} />
    </li>
  )
}
