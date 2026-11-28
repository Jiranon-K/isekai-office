import { describe, expect, test } from 'bun:test'
import { READ_ONLY_REASON } from '@/lib/source-caps'
import { commandFailureText } from './command-error-logic'

describe('command failure text', () => {
  test('a pending permission asks to answer allow or deny before sending again', () => {
    expect(commandFailureText('pending_decision')).toBe('ตอบ อนุญาต หรือ ปฏิเสธ ก่อนจึงส่งข้อความต่อได้')
  })

  test('a read only source shows the same reason as the rest of the app', () => {
    expect(commandFailureText('read_only_source')).toBe(READ_ONLY_REASON)
  })

  test('a known code shows its own Thai sentence', () => {
    expect(commandFailureText('no_pending_prompt')).toBe('ไม่มีคำขออนุญาตค้างอยู่แล้ว ลองรีเฟรชดู')
    expect(commandFailureText('server_unreachable')).toBe('ติดต่อ server ไม่ได้ ลองใหม่อีกครั้ง')
  })

  test('an unknown code shows the generic retry text without the raw code', () => {
    expect(commandFailureText('write_failed')).toBe('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง')
    expect(commandFailureText('constructor')).toBe('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง')
  })
})
