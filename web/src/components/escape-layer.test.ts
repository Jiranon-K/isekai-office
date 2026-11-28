import { expect, test } from 'bun:test'
import { takesEscape } from './escape-layer'

const escape = { key: 'Escape', defaultPrevented: false, isComposing: false }

test('the top layer takes Escape', () => {
  expect(takesEscape(escape, true)).toBe(true)
})

test('a lower layer leaves Escape to the one above it', () => {
  expect(takesEscape(escape, false)).toBe(false)
})

test('Escape that another handler or the input method already used is left alone', () => {
  expect(takesEscape({ ...escape, defaultPrevented: true }, true)).toBe(false)
  expect(takesEscape({ ...escape, isComposing: true }, true)).toBe(false)
  expect(takesEscape({ ...escape, key: 'Enter' }, true)).toBe(false)
})
