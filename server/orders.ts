import { homedir } from 'node:os'
import type { OfficeAgent } from '@shared/types'
import type { OrderChange, OrderResult, RuleLayer, StandingOrders } from '@shared/orders'
import { isTooBroad, toRule } from '@shared/rules'
import { changeLocalRule, readLayers } from './sources/permissions'

export type OrdersView = { layers: RuleLayer[]; writable: boolean }

export type OrdersFeeds = {
  read(agent: OfficeAgent): Promise<OrdersView>
  change(agent: OfficeAgent, change: OrderChange): Promise<OrderResult>
}

export type OrdersReply = { status: number; body: StandingOrders | OrderResult }

type ParsedChange = { agentId: string; op: OrderChange['op']; list: OrderChange['list']; rule: string }

const REMOVE_RULE_MAX_LENGTH = 1000

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

const ERROR_STATUS: Record<string, number> = {
  unparseable: 409,
  unreadable: 409,
  no_worktree: 409,
  unsafe_path: 409,
  write_failed: 500
}

function failure(status: number, error: string): OrdersReply {
  return { status, body: { ok: false, error } }
}

function parseChange(body: unknown): ParsedChange | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const agentId = Reflect.get(body, 'agentId')
  const op = Reflect.get(body, 'op')
  const list = Reflect.get(body, 'list')
  const rule = Reflect.get(body, 'rule')
  if (typeof agentId !== 'string' || typeof rule !== 'string') {
    return null
  }
  if ((op !== 'add' && op !== 'remove') || (list !== 'allow' && list !== 'deny')) {
    return null
  }
  return { agentId, op, list, rule }
}

function cleanRule(parsed: ParsedChange): string | null {
  if (parsed.op === 'add') {
    return toRule(parsed.rule)
  }
  const plain = parsed.rule.length > 0 && parsed.rule.length <= REMOVE_RULE_MAX_LENGTH && !CONTROL_CHARACTERS.test(parsed.rule)
  return plain ? parsed.rule : null
}

export async function readOrders(agentId: string, agentFor: (id: string) => OfficeAgent | null, feeds: OrdersFeeds): Promise<OrdersReply> {
  const agent = agentFor(agentId)
  if (!agent) {
    return failure(404, 'not_found')
  }
  const view = await feeds.read(agent)
  return { status: 200, body: { agentId, layers: view.layers, writable: view.writable } }
}

export async function changeOrders(body: unknown, agentFor: (id: string) => OfficeAgent | null, feeds: OrdersFeeds): Promise<OrdersReply> {
  const parsed = parseChange(body)
  if (!parsed) {
    return failure(400, 'bad_request')
  }
  const agent = agentFor(parsed.agentId)
  if (!agent) {
    return failure(404, 'not_found')
  }
  const rule = cleanRule(parsed)
  if (rule === null) {
    return failure(400, 'invalid_rule')
  }
  if (parsed.op === 'add' && parsed.list === 'allow' && isTooBroad(rule)) {
    return failure(400, 'too_broad')
  }
  const result = await feeds.change(agent, { agentId: parsed.agentId, op: parsed.op, list: parsed.list, rule })
  return { status: result.ok ? 200 : (ERROR_STATUS[result.error ?? ''] ?? 500), body: result }
}

export const realOrdersFeeds: OrdersFeeds = {
  async read(agent) {
    const layers = await readLayers(agent.worktree, homedir())
    const local = layers.find((layer) => layer.scope === 'local')
    return { layers, writable: agent.worktree !== null && local?.error === null }
  },
  async change(agent, change) {
    if (agent.worktree === null) {
      return { ok: false, error: 'no_worktree' }
    }
    return changeLocalRule(agent.worktree, change)
  }
}
