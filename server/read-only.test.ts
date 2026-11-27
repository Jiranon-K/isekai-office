import { describe, expect, test } from 'bun:test'
import { readOnlyReply } from './read-only'

const READ_ONLY = { command: false, spawn: false, screen: false }
const FULL = { command: true, spawn: true, screen: true }

describe('read only source', () => {
  test('a command or a spawn on a read only source is refused with read_only_source', () => {
    expect(readOnlyReply(READ_ONLY, 'command')).toEqual({ ok: false, error: 'read_only_source' })
    expect(readOnlyReply(READ_ONLY, 'spawn')).toEqual({ ok: false, error: 'read_only_source' })
  })

  test('a source with the cap is let through', () => {
    expect(readOnlyReply(FULL, 'command')).toBeNull()
    expect(readOnlyReply(FULL, 'spawn')).toBeNull()
  })

  test('each cap is checked on its own', () => {
    expect(readOnlyReply({ ...FULL, spawn: false }, 'command')).toBeNull()
    expect(readOnlyReply({ ...FULL, command: false }, 'spawn')).toBeNull()
  })
})
