import { isDayDate } from '@shared/day-log'
import type { OfficeAgent } from '@shared/types'
import { localDay } from '../sources/usage'
import { ledgerBuilder, startOfDay } from './build'
import { demoLedger } from './demo-ledger'

type LedgerContext = { demo: boolean; agents(): OfficeAgent[]; build?: typeof ledgerBuilder.build }

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function handleLedger(url: URL, context: LedgerContext): Promise<Response | null> {
  if (url.pathname !== '/api/ledger') {
    return null
  }
  const requested = url.searchParams.get('date')
  const date = requested ?? localDay(new Date())
  if (!isDayDate(date) || startOfDay(date) === null) {
    return json({ error: 'bad_date' }, 400)
  }
  if (context.demo) {
    return json(demoLedger(date))
  }
  const build = context.build ?? ledgerBuilder.build
  const ledger = await build(date, context.agents())
  return ledger ? json(ledger) : json({ error: 'bad_date' }, 400)
}
