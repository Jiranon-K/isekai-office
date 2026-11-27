import { describe, expect, test } from 'bun:test'
import { ORDER_ERROR_LABELS } from './orders'

describe('ORDER_ERROR_LABELS', () => {
  test.each(['write_failed', 'unreadable', 'not_found', 'bad_request', 'too_broad', 'invalid_rule', 'unparseable', 'no_worktree', 'unsafe_path'])('%s has a Thai label', (code) => {
    expect(ORDER_ERROR_LABELS[code]).toMatch(/[\u0e00-\u0e7f]/)
  })
})
