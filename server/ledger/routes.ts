import { isDayDate } from '@shared/day-log'
import type { OfficeAgent } from '@shared/types'
import { localDay } from '@shared/ledger'
import { ledgerBuilder, startOfDay } from './build'
import { demoLedger } from './demo-ledger'

type LedgerContext = { demo: boolean; agents(): OfficeAgent[]; build?: typeof ledgerBuilder.build }

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function requestedDate(url: URL): string | null {
  const explicit = url.searchParams.get('date')
  if (explicit !== null) {
    return explicit
  }
  const day = url.searchParams.get('day') ?? 'today'
  const now = new Date()
  if (day === 'today') {
    return localDay(now)
  }
  return day === 'yesterday' ? localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)) : null
}

export async function handleLedger(url: URL, context: LedgerContext): Promise<Response | null> {
  if (url.pathname !== '/api/ledger') {
    return null
  }
  const date = requestedDate(url)
  if (date === null || !isDayDate(date) || startOfDay(date) === null) {
    return json({ error: 'bad_date' }, 400)
  }
  if (context.demo) {
    return json(demoLedger(date))
  }
  const build = context.build ?? ledgerBuilder.build
  const ledger = await build(date, context.agents())
  return ledger ? json(ledger) : json({ error: 'bad_date' }, 400)
}
