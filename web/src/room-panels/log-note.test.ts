import { describe, expect, test } from 'bun:test'
import { logNote } from './log-note'

describe('logNote', () => {
  test('says where the log is kept and for how many days', () => {
    expect(logNote({ directory: '/data/log', keepDays: 14 })).toContain('บันทึกเก็บไว้ที่ /data/log เป็นเวลา 14 วัน')
  })

  test('keeps the tab note while the location is not known yet', () => {
    expect(logNote(null)).toContain('บันทึกเฉพาะตอนมีแท็บเปิดอยู่')
    expect(logNote(null)).not.toContain('เก็บไว้ที่')
  })

  test('says nothing about a folder when the directory is empty', () => {
    expect(logNote({ directory: '', keepDays: 14 })).toBe(logNote(null))
  })

  test('no longer says the log is empty after a restart', () => {
    expect(logNote(null)).not.toContain('ว่างเมื่อ server เริ่มใหม่')
  })
})
