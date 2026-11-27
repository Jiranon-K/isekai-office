import { isDayDate, type LogDays } from '@shared/day-log'
import { keepDays } from './config'
import { demoDay, demoDayDate } from './demo-day'
import { listDays, logDirectory, readDay } from './store'

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

async function daysOf(demo: boolean): Promise<LogDays> {
  const days = demo ? [demoDayDate()] : await listDays()
  return { days, directory: demo ? '' : logDirectory(), keepDays: keepDays() }
}

async function dayOf(date: string | null, demo: boolean): Promise<Response> {
  if (!isDayDate(date)) {
    return json({ error: 'bad_date' }, 400)
  }
  if (!demo) {
    return json(await readDay(date))
  }
  const day = demoDay()
  return json(date === day.date ? day : { date, events: [] })
}

export async function handleDayLog(url: URL, demo: boolean): Promise<Response | null> {
  if (url.pathname === '/api/log/days') {
    return json(await daysOf(demo))
  }
  if (url.pathname === '/api/log/day') {
    return dayOf(url.searchParams.get('date'), demo)
  }
  return null
}
