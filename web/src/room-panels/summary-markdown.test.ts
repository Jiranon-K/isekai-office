import { describe, expect, test } from 'bun:test'
import { toMarkdown } from './summary-markdown'
import { formatDuration, isEmptyDay, spendText, watchedNote } from './summary-format'
import type { DaySummary } from './summary-logic'

const MINUTE = 60_000

const SUMMARY: DaySummary = {
  date: '2026-05-10',
  watchedMs: 180 * MINUTE,
  sessions: 3,
  finished: 2,
  waitingMs: 25 * MINUTE,
  waits: 2,
  medianWaitMs: 12.5 * MINUTE,
  longestWait: { title: 'Fix login', ms: 20 * MINUTE, at: new Date(2026, 4, 10, 10, 0).getTime() },
  busiestHour: 10,
  agents: [{ agentId: 'a1', title: 'Fix login', repo: null, workingMs: 90 * MINUTE, waitingMs: 25 * MINUTE, waits: 2, longestWaitMs: 20 * MINUTE, finished: true }],
  spend: { amount: 1.5, currency: 'USD', unpricedSessions: 0 }
}

describe('formatting', () => {
  test('durations round to minutes and never read as zero for a real wait', () => {
    expect(formatDuration(0)).toBe('0 นาที')
    expect(formatDuration(10_000)).toBe('1 นาที')
    expect(formatDuration(25 * MINUTE)).toBe('25 นาที')
    expect(formatDuration(65 * MINUTE)).toBe('1 ชม. 5 นาที')
    expect(formatDuration(120 * MINUTE)).toBe('2 ชม.')
  })

  test('the watched note always carries hours and minutes', () => {
    expect(watchedNote(180 * MINUTE)).toBe('นับเฉพาะช่วงที่เปิดแท็บไว้ (รวม 3 ชม. 0 นาที)')
    expect(watchedNote(95 * MINUTE)).toBe('นับเฉพาะช่วงที่เปิดแท็บไว้ (รวม 1 ชม. 35 นาที)')
  })
})

describe('toMarkdown', () => {
  test('holds the same numbers as the panel and the watched note', () => {
    const text = toMarkdown(SUMMARY)
    expect(text).toContain('# สรุปวัน 2026-05-10')
    expect(text).toContain('- session: 3')
    expect(text).toContain('- เสร็จแล้ว: 2')
    expect(text).toContain('- รอรวม: 25 นาที (2 ครั้ง)')
    expect(text).toContain('- รอนานที่สุด: Fix login · 20 นาที · นับตั้งแต่ 10:00 น.')
    expect(text).toContain('- รอครั้งกลาง: 13 นาที')
    expect(text).toContain('- ชั่วโมงที่ทำงานมากที่สุด: 10:00–11:00 น.')
    expect(text).toContain('| Fix login | 1 ชม. 30 นาที | 25 นาที | 2 |')
    expect(text).toContain('นับเฉพาะช่วงที่เปิดแท็บไว้ (รวม 3 ชม. 0 นาที)')
  })

  test('the spend line is the same text in the panel and in the Markdown, gold and money', () => {
    expect(spendText(SUMMARY)).toBe('◎ 150 (1.50 USD)')
    expect(toMarkdown(SUMMARY)).toContain('- ค่าใช้จ่าย: ◎ 150 (1.50 USD)')
    expect(spendText({ ...SUMMARY, spend: null })).toBeNull()
  })

  test('a spend that leaves out unpriced sessions says how many', () => {
    const partial = { ...SUMMARY, spend: { amount: 1.5, currency: 'USD', unpricedSessions: 2 } }
    expect(spendText(partial)).toBe('◎ 150 (1.50 USD) · ไม่รวม 2 session ที่ไม่มีราคา')
    expect(toMarkdown(partial)).toContain('- ค่าใช้จ่าย: ◎ 150 (1.50 USD) · ไม่รวม 2 session ที่ไม่มีราคา')
  })

  test('leaves the spend line out without a spend', () => {
    expect(toMarkdown(SUMMARY)).toContain('ค่าใช้จ่าย')
    expect(toMarkdown({ ...SUMMARY, spend: null })).not.toContain('ค่าใช้จ่าย')
  })

  test('an empty day says so and prints no numbers', () => {
    const empty = { ...SUMMARY, sessions: 0, agents: [], waits: 0, waitingMs: 0, longestWait: null, medianWaitMs: null, busiestHour: null }
    expect(isEmptyDay(empty)).toBe(true)
    expect(toMarkdown(empty)).toContain('ยังไม่มีข้อมูลของวันนี้')
    expect(toMarkdown(empty)).not.toContain('รอรวม')
  })
  test('a day with sessions but no watched time says so instead of printing zero waits', () => {
    const unwatched = { ...SUMMARY, watchedMs: 0, waits: 0, waitingMs: 0, longestWait: null, medianWaitMs: null, busiestHour: null }
    const text = toMarkdown(unwatched)
    expect(text).toContain('- session: 3')
    expect(text).toContain('- เสร็จแล้ว: 2')
    expect(text).toContain('วันนี้ไม่มีช่วงที่เปิดแท็บไว้ จึงนับเวลาไม่ได้')
    expect(text).not.toContain('รอรวม')
    expect(text).not.toContain('รอนานที่สุด')
  })
})
