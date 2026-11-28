import { describe, expect, test } from 'bun:test'
import { agentButtonLabel } from './OfficeCanvas'

describe('agentButtonLabel', () => {
  test('appends conflict suffix when agent id is in conflictIds', () => {
    const label = agentButtonLabel({ id: 'a1', title: 'ตะกร้าสินค้า', state: 'working' }, new Set(['a1']))
    expect(label).toBe('ตะกร้าสินค้า (กำลังทำงาน) · ไฟล์ชนกัน')
  })

  test('omits conflict suffix when agent is not in conflict or set is omitted', () => {
    expect(agentButtonLabel({ id: 'a2', title: 'ชำระเงิน', state: 'waiting' }, new Set(['a1']))).toBe('ชำระเงิน (รอคำสั่ง)')
    expect(agentButtonLabel({ id: 'a2', title: 'ชำระเงิน', state: 'done' })).toBe('ชำระเงิน (เสร็จแล้ว)')
  })
})
