import { describe, expect, test } from 'bun:test'
import type { OfficeSnapshot } from '@shared/types'
import { managedStatus, sourceHealth } from './source-health'

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

  test('formats managed session status when managedCap is present', () => {
    expect(managedStatus(null)).toBeNull()
    expect(managedStatus(snapshotOf('local', true))).toBeNull()
    expect(managedStatus({ ...snapshotOf('local', true), managedCap: 4 })).toBe('คุมโดยห้อง 0/4')
    expect(managedStatus({ ...snapshotOf('local', true), managedCount: 2, managedCap: 4 })).toBe('คุมโดยห้อง 2/4')
  })
})
