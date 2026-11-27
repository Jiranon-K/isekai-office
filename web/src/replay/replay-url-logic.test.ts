import { describe, expect, test } from 'bun:test'
import { urlWriteDelay } from './replay-url-logic'

describe('urlWriteDelay', () => {
  test.each([
    { name: 'never written', now: 1000, lastWrite: 0, expected: 0 },
    { name: 'interval has passed', now: 1250, lastWrite: 1000, expected: 0 },
    { name: 'just wrote', now: 1000, lastWrite: 1000, expected: 250 },
    { name: 'wrote 100 ms ago', now: 1100, lastWrite: 1000, expected: 150 },
    { name: 'clock went backwards', now: 900, lastWrite: 1000, expected: 0 }
  ])('$name', ({ now, lastWrite, expected }) => {
    expect(urlWriteDelay(now, lastWrite)).toBe(expected)
  })
})
