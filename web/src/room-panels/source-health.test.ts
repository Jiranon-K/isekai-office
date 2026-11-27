import { describe, expect, test } from 'bun:test'
import type { OfficeSnapshot } from '@shared/types'
import { sourceHealth } from './source-health'

function snapshotOf(source: OfficeSnapshot['source'], sourceReady: boolean): OfficeSnapshot {
  return { source, caps: { command: false, spawn: false, screen: false }, sourceReady, agents: [], contextWindow: 1, quietAfterMs: 1, error: null, at: 1 }
}

describe('source health', () => {
  test('no snapshot yet is unknown', () => {
    expect(sourceHealth(null)).toEqual({ label: 'ยังไม่ทราบ', ok: false })
  })

  test('the local source reads Claude Code files', () => {
    expect(sourceHealth(snapshotOf('local', true))).toEqual({ label: 'Claude Code (อ่านไฟล์)', ok: true })
  })

  test('orca is named, and flagged when the app is closed', () => {
    expect(sourceHealth(snapshotOf('orca', true))).toEqual({ label: 'Orca', ok: true })
    expect(sourceHealth(snapshotOf('orca', false))).toEqual({ label: 'Orca (ปิดอยู่)', ok: false })
  })
})
