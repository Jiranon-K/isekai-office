import type { BoardColumn, LoopStage, QuestCard, Sprint, SprintState } from '@shared/types'
import { runText } from './run'

const WORKSPACE_URL = (process.env.WORKSPACE_URL ?? '').replace(/\/+$/, '')
const MCP_URL = `${WORKSPACE_URL}/api/mcp`
const TASK_URL = `${WORKSPACE_URL}/tasks/`
const KEYCHAIN_SERVICE = 'isekai-office-workspace'
const SPACES = (process.env.BOARD_SPACES ?? '').split(',').filter(Boolean)

type RawStatus = { id: string; name: string; category: string; isReview?: boolean }
type RawSpace = { id: string | null; key?: string; name?: string; statuses?: RawStatus[] }
type RawTask = {
  id: string
  key: string | null
  title: string
  status: string
  priority?: string | null
  assignee?: { name?: string } | null
  epic?: { title?: string } | null
  sprint?: { name?: string } | null
  labels?: string[]
  route?: string | null
  inReview?: boolean
  updatedAt: string
}
type RawSprint = { name?: string; state?: string; start_date?: string | null; end_date?: string | null; goal?: string | null }
type RawView = { groups: { key: string; label: string; tasks: RawTask[] }[] }
type ToolResult = { result?: { content?: { type: string; text?: string }[]; isError?: boolean }; error?: { message?: string } }

let cachedToken: string | null = null

async function token(): Promise<string> {
  if (cachedToken) {
    return cachedToken
  }
  const value = (
    await runText(['security', 'find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', 'me', '-w']).catch(() => '')
  ).trim()
  if (!value) {
    throw new Error('missing_token')
  }
  cachedToken = value.replace(/^bearer\s+/i, '')
  return cachedToken
}

export function parseRpcBody(body: string): ToolResult {
  const trimmed = body.trim()
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed)
  }
  const data = trimmed
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .at(-1)
  if (!data) {
    throw new Error('empty_mcp_response')
  }
  return JSON.parse(data)
}

async function callTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!WORKSPACE_URL) {
    throw new Error('missing_workspace_url')
  }
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await token()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
  })
  if (response.status === 401) {
    cachedToken = null
    throw new Error('unauthorized')
  }
  const parsed = parseRpcBody(await response.text())
  const text = parsed.result?.content?.find((part) => part.type === 'text')?.text
  if (parsed.error || parsed.result?.isError || !text) {
    throw new Error(parsed.error?.message ?? text ?? `${name} failed`)
  }
  return JSON.parse(text)
}

const HIDDEN_STATUSES = new Set(["Won't Do", 'Cancelled'])
const REVIEW_STATUSES = new Set(['Verifying'])
const SPRINT_STATES = new Set<SprintState>(['running', 'planned', 'closed'])

export function columnFor(status: RawStatus | undefined, inReview: boolean): BoardColumn | null {
  if (status?.category === 'cancelled' || (status && HIDDEN_STATUSES.has(status.name))) {
    return null
  }
  if (inReview || status?.isReview || (status && REVIEW_STATUSES.has(status.name))) {
    return 'review'
  }
  if (status?.category === 'done') {
    return 'done'
  }
  if (status?.category === 'active') {
    return 'doing'
  }
  return 'todo'
}

export function toCard(
  task: RawTask,
  space: string,
  status: RawStatus | undefined,
  loop: LoopStage | null
): QuestCard | null {
  const column = columnFor(status, task.inReview ?? false)
  if (!column) {
    return null
  }
  return {
    id: task.id,
    key: task.key,
    title: task.title,
    space,
    status: task.status,
    column,
    priority: task.priority ?? null,
    assignee: task.assignee?.name ?? null,
    sprint: task.sprint?.name ?? null,
    epic: task.epic?.title ?? null,
    labels: task.labels ?? [],
    route: task.route ?? null,
    updatedAt: task.updatedAt,
    url: `${TASK_URL}${task.key ?? task.id}`,
    loop,
    mergeRequest: null
  }
}

export function toSprint(raw: RawSprint, space: string): Sprint | null {
  if (!raw.name || !SPRINT_STATES.has(raw.state as SprintState)) {
    return null
  }
  return { space, name: raw.name, state: raw.state as SprintState, endDate: raw.end_date ?? null, goal: raw.goal ?? null }
}

async function sprintsOfSpace(space: string): Promise<Sprint[]> {
  const result = await callTool<{ sprints?: RawSprint[] } | RawSprint[]>('list_sprints', { space })
  const raws = Array.isArray(result) ? result : (result.sprints ?? [])
  return raws.flatMap((raw) => {
    const sprint = toSprint(raw, space)
    return sprint ? [sprint] : []
  })
}

export async function loadSprints(): Promise<Sprint[]> {
  const settled = await Promise.allSettled(SPACES.map(sprintsOfSpace))
  return settled.flatMap((outcome) => (outcome.status === 'fulfilled' ? outcome.value : []))
}

async function statusesBySpace(): Promise<Map<string, Map<string, RawStatus>>> {
  const result = await callTool<{ spaces?: RawSpace[] } | RawSpace[]>('list_spaces', {})
  const spaces = Array.isArray(result) ? result : (result.spaces ?? [])
  const bySpace = new Map<string, Map<string, RawStatus>>()
  for (const space of spaces) {
    if (space.key) {
      bySpace.set(space.key, new Map((space.statuses ?? []).map((status) => [status.id, status])))
    }
  }
  return bySpace
}

export async function loadCards(loop: Map<string, LoopStage>): Promise<QuestCard[]> {
  const statuses = await statusesBySpace()
  const views = await Promise.all(
    SPACES.map(async (space) => ({
      space,
      view: await callTool<RawView>('query_view', { space, assignee: 'me', view_type: 'board' })
    }))
  )
  return views.flatMap(({ space, view }) =>
    view.groups.flatMap((group) =>
      group.tasks.flatMap((task) => {
        const card = toCard(task, space, statuses.get(space)?.get(group.key), task.key ? (loop.get(task.key) ?? null) : null)
        return card ? [card] : []
      })
    )
  )
}
