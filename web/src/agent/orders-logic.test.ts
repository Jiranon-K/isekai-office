import { describe, expect, test } from 'bun:test'
import type { RuleLayer, StandingOrders } from '@shared/orders'
import { ORDER_PRESETS } from '@shared/rules'
import { canEdit, canRemove, checkDraft, describeLayerError, describeOrderError, draftFromRule, entriesFor } from './orders-logic'

const USER: RuleLayer = { scope: 'user', allow: ['Read'], deny: [], ask: [], error: null }
const LOCAL: RuleLayer = { scope: 'local', allow: ['Bash(bun test)'], deny: ['Bash(rm *)'], ask: [], error: null }

function ordersWith(layers: RuleLayer[], writable = true): StandingOrders {
  return { agentId: 'a1', layers, writable }
}

describe('entriesFor', () => {
  test('rules of one list come from every layer with their scope', () => {
    expect(entriesFor([USER, LOCAL], 'allow')).toEqual([
      { rule: 'Read', scope: 'user' },
      { rule: 'Bash(bun test)', scope: 'local' }
    ])
    expect(entriesFor([USER, LOCAL], 'ask')).toEqual([])
  })
})

describe('editing rights', () => {
  test('only local rules can be removed and only while the local file reads fine', () => {
    const orders = ordersWith([USER, LOCAL])
    expect(canRemove({ rule: 'Read', scope: 'user' }, orders)).toBe(false)
    expect(canRemove({ rule: 'Bash(bun test)', scope: 'local' }, orders)).toBe(true)
    expect(canRemove({ rule: 'Bash(bun test)', scope: 'local' }, ordersWith([{ ...LOCAL, error: 'unparseable' }]))).toBe(false)
  })

  test('a read only agent or a broken local file disables editing', () => {
    expect(canEdit(ordersWith([USER, LOCAL], false))).toBe(false)
    expect(canEdit(ordersWith([USER, { ...LOCAL, error: 'unparseable' }]))).toBe(false)
    expect(canEdit(ordersWith([USER, LOCAL]))).toBe(true)
  })
})

describe('checkDraft', () => {
  test('a good draft gives the rule', () => {
    expect(checkDraft({ list: 'allow', tool: 'Bash', pattern: 'bun test' })).toEqual({ rule: 'Bash(bun test)', problem: null })
  })

  test('a broad allow draft shows the Thai reason and the same rule is fine in deny', () => {
    expect(checkDraft({ list: 'allow', tool: 'Bash', pattern: 'rm -rf *' }).problem).toBe('กว้างเกินไป เพิ่มเองในไฟล์ได้ถ้าตั้งใจจริง')
    expect(checkDraft({ list: 'deny', tool: 'Bash', pattern: 'rm -rf *' }).rule).toBe('Bash(rm -rf *)')
  })

  test('a bare Bash allow and a draft with a newline are refused', () => {
    expect(checkDraft({ list: 'allow', tool: 'Bash', pattern: '' }).rule).toBeNull()
    expect(checkDraft({ list: 'allow', tool: 'Bash', pattern: 'ls\nrm' }).rule).toBeNull()
  })

  test('every preset passes as a draft', () => {
    for (const preset of ORDER_PRESETS) {
      expect(checkDraft({ ...draftFromRule(preset.rule), list: 'allow' }).rule).toBe(preset.rule)
    }
  })
})

describe('messages', () => {
  test('known codes have Thai text and unknown codes fall back', () => {
    expect(describeOrderError('unparseable')).toBe('อ่านไฟล์นี้ไม่ได้')
    expect(describeOrderError('weird')).toBe('บันทึกไม่สำเร็จ')
    expect(describeOrderError(null)).toBe('')
  })

  test('a layer error shows the unreadable text and no error shows nothing', () => {
    expect(describeLayerError('unreadable')).toBe('อ่านไฟล์นี้ไม่ได้')
    expect(describeLayerError(null)).toBeNull()
  })
})

describe('draftFromRule', () => {
  test('a rule splits into tool and pattern', () => {
    expect(draftFromRule('Bash(git diff *)')).toEqual({ list: 'allow', tool: 'Bash', pattern: 'git diff *' })
    expect(draftFromRule('WebSearch')).toEqual({ list: 'allow', tool: 'WebSearch', pattern: '' })
  })
})
