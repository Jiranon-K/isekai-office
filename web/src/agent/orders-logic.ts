import { ORDER_ERROR_LABELS, type RuleLayer, type RuleList, type RuleScope, type StandingOrders } from '@shared/orders'
import { buildRule, isTooBroad, toRule } from '@shared/rules'

export type RuleEntry = { rule: string; scope: RuleScope }

export type OrderDraft = { list: 'allow' | 'deny'; tool: string; pattern: string }

export type DraftCheck = { rule: string | null; problem: string | null }

export const EMPTY_DRAFT: OrderDraft = { list: 'allow', tool: 'Bash', pattern: '' }

export const SCOPE_FILES: Record<RuleScope, string> = {
  user: '~/.claude/settings.json',
  project: '.claude/settings.json',
  local: '.claude/settings.local.json'
}

export function entriesFor(layers: RuleLayer[], list: RuleList): RuleEntry[] {
  return layers.flatMap((layer) => layer[list].map((rule) => ({ rule, scope: layer.scope })))
}

export function localLayer(orders: StandingOrders): RuleLayer | null {
  return orders.layers.find((layer) => layer.scope === 'local') ?? null
}

export function canEdit(orders: StandingOrders): boolean {
  return orders.writable && localLayer(orders)?.error === null
}

export function canRemove(entry: RuleEntry, orders: StandingOrders): boolean {
  return entry.scope === 'local' && canEdit(orders)
}

export function describeOrderError(code: string | null): string {
  if (code === null) {
    return ''
  }
  return ORDER_ERROR_LABELS[code] ?? 'บันทึกไม่สำเร็จ'
}

export function describeLayerError(error: string | null): string | null {
  return error === null ? null : describeOrderError('unparseable')
}

export function checkDraft(draft: OrderDraft): DraftCheck {
  const rule = toRule(buildRule(draft.tool, draft.pattern))
  if (rule === null) {
    return { rule: null, problem: describeOrderError('invalid_rule') }
  }
  if (draft.list === 'allow' && isTooBroad(rule)) {
    return { rule: null, problem: describeOrderError('too_broad') }
  }
  return { rule, problem: null }
}

export function draftFromRule(rule: string): OrderDraft {
  const match = /^([^(]+)(?:\((.*)\))?$/.exec(rule)
  return { list: 'allow', tool: match?.[1] ?? 'Bash', pattern: match?.[2] ?? '' }
}
