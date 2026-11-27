import type { OfficeAgent } from '@shared/types'
import { Badge } from '@/components/badge'
import { formatGold, formatMoney, sessionCost } from './ledger-logic'
import { useLedger } from './use-ledger'

export function SessionGold({ agent }: { agent: OfficeAgent }): React.JSX.Element | null {
  const ledger = useLedger('today', true, true)
  const cost = sessionCost(ledger.data, agent)
  if (cost === null) {
    return null
  }
  return (
    <Badge variant="amber" className="font-mono" title={`${formatMoney(cost, ledger.data?.currency ?? null)} วันนี้`}>
      {formatGold(cost)}
    </Badge>
  )
}
