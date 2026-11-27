import { appendFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { DayEvent, DayLog } from '@shared/day-log'
import { isDayDate } from '@shared/day-log'
import type { LogEvent } from '@shared/types'
import { dataDir } from '../data-dir'
import { keepDays } from './config'
import { localDate, stateOnly } from './events'

const DAY_MS = 86_400_000
const TAIL_BYTES = 256 * 1024
const EXTENSION = '.jsonl'

export function logDirectory(): string {
  return join(dataDir(), 'log')
}

function dayFile(date: string): string {
  return join(logDirectory(), `${date}${EXTENSION}`)
}

function isDayEvent(value: unknown): value is DayEvent {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const kind = (value as { kind?: unknown }).kind
  return kind === 'state' || kind === 'station' || kind === 'watch'
}

function parseLine(line: string): DayEvent | null {
  try {
    const parsed: unknown = JSON.parse(line)
    return isDayEvent(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function parseDayText(text: string): DayEvent[] {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map(parseLine)
    .filter((event) => event !== null)
}

export async function appendDayEvents(date: string, events: DayEvent[]): Promise<void> {
  if (events.length === 0) {
    return
  }
  await mkdir(logDirectory(), { recursive: true })
  await appendFile(dayFile(date), events.map((event) => `${JSON.stringify(event)}\n`).join(''))
}

export async function dayFileBytes(date: string): Promise<number> {
  try {
    return (await stat(dayFile(date))).size
  } catch {
    return 0
  }
}

export async function readDay(date: string): Promise<DayLog> {
  const file = Bun.file(dayFile(date))
  if (!(await file.exists())) {
    return { date, events: [] }
  }
  return { date, events: parseDayText(await file.text()) }
}

export async function listDays(): Promise<string[]> {
  try {
    const names = await readdir(logDirectory())
    return names
      .filter((name) => name.endsWith(EXTENSION))
      .map((name) => name.slice(0, -EXTENSION.length))
      .filter(isDayDate)
      .sort()
      .reverse()
  } catch {
    return []
  }
}

export async function pruneDays(now: number): Promise<string[]> {
  const cutoff = localDate(now - keepDays() * DAY_MS)
  const expired = (await listDays()).filter((date) => date < cutoff)
  await Promise.all(expired.map((date) => rm(dayFile(date), { force: true })))
  return expired
}

export async function readRecentStates(date: string, limit: number): Promise<LogEvent[]> {
  const file = Bun.file(dayFile(date))
  if (!(await file.exists())) {
    return []
  }
  const start = Math.max(0, file.size - TAIL_BYTES)
  const text = await file.slice(start).text()
  const complete = start > 0 ? text.slice(text.indexOf('\n') + 1) : text
  return stateOnly(parseDayText(complete)).slice(-limit)
}
