export type RuleList = 'allow' | 'deny' | 'ask'

export type RuleScope = 'user' | 'project' | 'local'

export type RuleLayer = { scope: RuleScope; allow: string[]; deny: string[]; ask: string[]; error: string | null }

export type StandingOrders = { agentId: string; layers: RuleLayer[]; writable: boolean }

export type OrderChange = { agentId: string; op: 'add' | 'remove'; list: 'allow' | 'deny'; rule: string }

export type OrderResult = { ok: boolean; error: string | null }

export type OrderPreset = { label: string; rule: string }

export const SCOPE_LABELS: Record<RuleScope, string> = {
  user: 'ทั้งเครื่อง',
  project: 'repo',
  local: 'worktree นี้'
}

export const LIST_LABELS: Record<RuleList, string> = {
  allow: 'อนุญาตเสมอ',
  deny: 'ห้ามเสมอ',
  ask: 'ถามเสมอ'
}

export const ORDER_ERROR_LABELS: Record<string, string> = {
  too_broad: 'กว้างเกินไป เพิ่มเองในไฟล์ได้ถ้าตั้งใจจริง',
  invalid_rule: 'รูปแบบกฎไม่ถูกต้อง',
  unparseable: 'อ่านไฟล์นี้ไม่ได้',
  no_worktree: 'session นี้ไม่มี worktree ที่แก้ได้',
  not_found: 'ไม่พบ session นี้',
  bad_request: 'คำขอไม่ถูกต้อง',
  unreadable: 'เปิดไฟล์นี้ไม่ได้',
  write_failed: 'เขียนไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง',
  server_unreachable: 'ติดต่อ server ไม่ได้'
}
