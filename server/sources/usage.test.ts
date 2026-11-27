import { describe, expect, test } from 'bun:test'
import { createUsageState, addUsage, totalsForDay, usageOf } from './usage'
import { assistantLine, localNoon, usageOfSize } from './usage-fixtures'

const NOON = localNoon(2026, 5, 10)

function feed(lines: string[]) {
  const state = createUsageState()
  for (const line of lines) {
    const usage = usageOf(line)
    if (usage) {
      addUsage(state, usage)
    }
  }
  return state
}

describe('usageOf', () => {
  test('reads the five counts, the model and the local day', () => {
    const usage = usageOf(assistantLine('m1', NOON, usageOfSize(1)))
    expect(usage).toEqual({ id: 'm1', model: 'claude-sonnet-x', day: '2026-05-10', tokens: usageOfSize(1) })
  })

  test('a line with no usage, a user line and a broken line give nothing', () => {
    expect(usageOf(JSON.stringify({ type: 'assistant', message: { id: 'm1' } }))).toBeNull()
    expect(usageOf(JSON.stringify({ type: 'user', message: { usage: {} } }))).toBeNull()
    expect(usageOf('{"type":"assistant","usage": broken')).toBeNull()
  })

  test('without the cache split the whole cache write counts as five minutes', () => {
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: NOON,
      message: { id: 'm1', usage: { input_tokens: 1, cache_creation_input_tokens: 7 } }
    })
    expect(usageOf(line)?.tokens).toEqual({ input: 1, output: 0, cacheRead: 0, cacheWrite5m: 7, cacheWrite1h: 0 })
  })

  test('the day follows local time at the boundary', () => {
    const lastMinute = new Date(2026, 4, 10, 23, 59, 0).toISOString()
    const firstMinute = new Date(2026, 4, 11, 0, 1, 0).toISOString()
    expect(usageOf(assistantLine('a', lastMinute, usageOfSize(1)))?.day).toBe('2026-05-10')
    expect(usageOf(assistantLine('b', firstMinute, usageOfSize(1)))?.day).toBe('2026-05-11')
  })
})

describe('addUsage', () => {
  test('one id spread over three lines is counted once', () => {
    const line = assistantLine('m1', NOON, usageOfSize(2))
    const totals = totalsForDay(feed([line, line, line]), '2026-05-10')
    expect(totals.get('claude-sonnet-x')).toEqual(usageOfSize(2))
  })

  test('two ids add up', () => {
    const state = feed([assistantLine('m1', NOON, usageOfSize(1)), assistantLine('m1', NOON, usageOfSize(1)), assistantLine('m2', NOON, usageOfSize(10))])
    expect(totalsForDay(state, '2026-05-10').get('claude-sonnet-x')?.input).toBe(11)
  })

  test('a line from yesterday is not in today', () => {
    const state = feed([assistantLine('m1', localNoon(2026, 5, 9), usageOfSize(1)), assistantLine('m2', NOON, usageOfSize(1))])
    expect(totalsForDay(state, '2026-05-10').get('claude-sonnet-x')?.input).toBe(1)
    expect(totalsForDay(state, '2026-05-09').get('claude-sonnet-x')?.input).toBe(1)
  })
})

describe('message ids across lines and files', () => {
  test('an id interleaved with another id is still counted once', () => {
    const first = assistantLine('a', NOON, usageOfSize(1))
    const state = feed([first, assistantLine('b', NOON, usageOfSize(10)), first])
    expect(totalsForDay(state, '2026-05-10').get('claude-sonnet-x')?.input).toBe(11)
  })

  test('a later line for the same id replaces the earlier one', () => {
    const state = feed([assistantLine('a', NOON, usageOfSize(1)), assistantLine('b', NOON, usageOfSize(10)), assistantLine('a', NOON, usageOfSize(3))])
    expect(totalsForDay(state, '2026-05-10').get('claude-sonnet-x')?.input).toBe(13)
  })

  test('an id already counted from another file is skipped', () => {
    const counted = new Set<string>()
    const line = assistantLine('a', NOON, usageOfSize(1))
    const firstFile = totalsForDay(feed([line]), '2026-05-10', counted)
    const secondFile = totalsForDay(feed([line, assistantLine('c', NOON, usageOfSize(5))]), '2026-05-10', counted)
    expect(firstFile.get('claude-sonnet-x')?.input).toBe(1)
    expect(secondFile.get('claude-sonnet-x')?.input).toBe(5)
  })
})

describe('empty usage', () => {
  const nothing = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }

  test('a synthetic or zero token line leaves no model entry', () => {
    const state = feed([assistantLine('a', NOON, nothing, '<synthetic>'), assistantLine('b', NOON, nothing), assistantLine('c', NOON, usageOfSize(1), 'real')])
    expect([...totalsForDay(state, '2026-05-10').keys()]).toEqual(['real'])
  })
})
