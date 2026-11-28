import { describe, expect, test } from 'bun:test'
import { formatStateDuration, stateLine } from './state-duration'

const MINUTE = 60_000

describe('formatStateDuration', () => {
  test('under a minute reads as under one minute, never as zero minutes', () => {
    expect(formatStateDuration(0)).toBe('ไม่ถึง 1 นาที')
    expect(formatStateDuration(59_000)).toBe('ไม่ถึง 1 นาที')
  })

  test('a minute and up reads in minutes', () => {
    expect(formatStateDuration(60_000)).toBe('1 นาที')
    expect(formatStateDuration(59 * MINUTE + 59_000)).toBe('59 นาที')
  })

  test('an hour and up reads in hours and minutes', () => {
    expect(formatStateDuration(61 * MINUTE)).toBe('1 ชม. 1 นาที')
    expect(formatStateDuration(125 * MINUTE)).toBe('2 ชม. 5 นาที')
  })

  test('a start time in the future counts as zero', () => {
    expect(formatStateDuration(-5_000)).toBe('ไม่ถึง 1 นาที')
  })
})

describe('stateLine', () => {
  test('a working character shows how long it has been working', () => {
    expect(stateLine('working', 1_000, 1_000 + 3 * MINUTE)).toBe('ทำงานมา 3 นาที')
  })

  test('a waiting character shows how long it has waited for the user', () => {
    expect(stateLine('waiting', 1_000, 1_000)).toBe('รอคุณมา ไม่ถึง 1 นาที')
  })

  test('other states show their name and the duration', () => {
    expect(stateLine('blocked', 0, 2 * MINUTE)).toBe('ติดขัด 2 นาที')
  })

  test('a missing start time shows only the state name, never a duration', () => {
    expect(stateLine('waiting', null, 5 * MINUTE)).toBe('รอคำสั่ง')
    expect(stateLine('working', Number.NaN, 5 * MINUTE)).toBe('กำลังทำงาน')
  })
})
