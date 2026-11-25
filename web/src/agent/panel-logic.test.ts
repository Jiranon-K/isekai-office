import { describe, expect, test } from 'bun:test'
import {
  decisionLocked,
  describeResult,
  formatContextLoad,
  isLongText,
  isNearEnd,
  lastScreenLines,
  needsDecision,
  shouldSubmitOnKey,
  startsNewDay,
  toolCounts,
  visibleStart
} from './panel-logic'

describe('panel logic', () => {
  test('asks for a decision when blocked', () => {
    expect(needsDecision('blocked')).toBe(true)
  })

  test('does not ask for a decision when working', () => {
    expect(needsDecision('working')).toBe(false)
  })

  test('shows the context load as thousands of tokens and a percent', () => {
    expect(formatContextLoad(142_000, 1_000_000)).toBe('142k · 14%')
  })

  test('shows no context load when the tokens are unknown', () => {
    expect(formatContextLoad(null, 1_000_000)).toBeNull()
  })

  test('keeps only the last screen lines', () => {
    expect(lastScreenLines('a\nb\nc\nd\n', 2)).toBe('c\nd')
  })

  test('returns the server error text on failure', () => {
    expect(describeResult({ ok: false, error: 'no_terminal' })).toBe('no_terminal')
  })

  test('returns null on success', () => {
    expect(describeResult({ ok: true, error: null })).toBeNull()
  })

  test('Enter submits', () => {
    expect(shouldSubmitOnKey('Enter', false, false)).toBe(true)
  })

  test('Shift+Enter does not submit', () => {
    expect(shouldSubmitOnKey('Enter', true, false)).toBe(false)
  })

  test('Enter while composing Thai text does not submit', () => {
    expect(shouldSubmitOnKey('Enter', false, true)).toBe(false)
  })

  test('counts repeated tools once', () => {
    expect(toolCounts(['Bash', 'Edit', 'Bash'])).toEqual([
      { name: 'Bash', count: 2 },
      { name: 'Edit', count: 1 }
    ])
  })

  test('a short message is not clamped and a long one is', () => {
    expect(isLongText('ok')).toBe(false)
    expect(isLongText('x'.repeat(500))).toBe(true)
    expect(isLongText('a\n'.repeat(12))).toBe(true)
  })

  test('the list follows new messages only while the reader is at the end', () => {
    expect(isNearEnd(560, 400, 1000)).toBe(true)
    expect(isNearEnd(100, 400, 1000)).toBe(false)
  })

  test('a day divider opens the list and each new day', () => {
    const noon = new Date(2026, 10, 25, 12).getTime()
    const nextDay = new Date(2026, 10, 26, 12).getTime()
    expect(startsNewDay(undefined, noon)).toBe(true)
    expect(startsNewDay(noon, noon + 60_000)).toBe(false)
    expect(startsNewDay(noon, nextDay)).toBe(true)
    expect(startsNewDay(noon, null)).toBe(false)
  })

  test('older messages stay hidden until asked for', () => {
    expect(visibleStart(200, 40)).toBe(160)
    expect(visibleStart(12, 40)).toBe(0)
  })

  test('the decision buttons lock while a command is sending', () => {
    expect(decisionLocked('sending', null, 10)).toBe(true)
  })

  test('they stay locked after a sent command until the agent changes', () => {
    expect(decisionLocked('sent', 10, 10)).toBe(true)
    expect(decisionLocked('sent', 10, 11)).toBe(false)
  })

  test('they unlock when the command failed or nothing was sent', () => {
    expect(decisionLocked('failed', 10, 10)).toBe(false)
    expect(decisionLocked('idle', null, 10)).toBe(false)
  })
})
