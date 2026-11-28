import type { AgentDiff, DiffSummary, DiffSummaryResponse } from '@shared/diff'
import type { OfficeAgent } from '@shared/types'
import { demoDiff } from './demo-diff'
import { readGitDiff } from './git'

const MAX_SUMMARY_IDS = 20

export type DiffRouteContext = {
  demo: boolean
  agents(): OfficeAgent[]
  readDiff?: (agentId: string, worktree: string) => Promise<AgentDiff>
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function noWorktreeDiff(agentId: string): AgentDiff {
  return {
    agentId,
    branch: null,
    files: [],
    totalAdded: 0,
    totalRemoved: 0,
    truncated: false,
    error: 'no_worktree'
  }
}

function unavailableSummary(agentId: string): DiffSummary {
  return {
    agentId,
    files: 0,
    added: 0,
    removed: 0,
    clean: false,
    unavailable: true
  }
}

export function toDiffSummary(diff: AgentDiff): DiffSummary {
  if (diff.error !== null) {
    return unavailableSummary(diff.agentId)
  }
  return {
    agentId: diff.agentId,
    files: diff.files.length,
    added: diff.totalAdded,
    removed: diff.totalRemoved,
    clean: diff.files.length === 0,
    unavailable: false
  }
}

function parseSummaryIds(rawIds: string | null): string[] {
  if (!rawIds) {
    return []
  }
  const unique: string[] = []
  const seen = new Set<string>()
  for (const part of rawIds.split(',')) {
    const id = part.trim()
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    unique.push(id)
    if (unique.length >= MAX_SUMMARY_IDS) {
      break
    }
  }
  return unique
}

async function resolveAgentDiff(agent: OfficeAgent, context: DiffRouteContext): Promise<AgentDiff> {
  if (context.demo) {
    return demoDiff(agent.id)
  }
  if (!agent.worktree) {
    return noWorktreeDiff(agent.id)
  }
  const readDiff = context.readDiff ?? readGitDiff
  return readDiff(agent.id, agent.worktree)
}

async function handleSingleDiff(rawAgentId: string, context: DiffRouteContext): Promise<Response> {
  let agentId: string
  try {
    agentId = decodeURIComponent(rawAgentId)
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const agent = context.agents().find((candidate) => candidate.id === agentId) ?? null
  if (!agent) {
    return json({ error: 'agent_not_found' }, 404)
  }
  return json(await resolveAgentDiff(agent, context))
}

async function handleDiffSummary(url: URL, context: DiffRouteContext): Promise<Response> {
  const ids = parseSummaryIds(url.searchParams.get('ids'))
  if (ids.length === 0) {
    const empty: DiffSummaryResponse = { summaries: [] }
    return json(empty)
  }
  const agentsById = new Map(context.agents().map((agent) => [agent.id, agent]))
  const summaries = await Promise.all(
    ids.map(async (id): Promise<DiffSummary> => {
      const agent = agentsById.get(id)
      if (!agent) {
        return unavailableSummary(id)
      }
      return toDiffSummary(await resolveAgentDiff(agent, context))
    })
  )
  const payload: DiffSummaryResponse = { summaries }
  return json(payload)
}

export async function handleDiff(request: Request, context: DiffRouteContext): Promise<Response | null> {
  if (request.method !== 'GET') {
    return null
  }
  const url = new URL(request.url)
  if (url.pathname === '/api/diff-summary') {
    return handleDiffSummary(url, context)
  }
  if (!url.pathname.startsWith('/api/diff/')) {
    return null
  }
  const rawAgentId = url.pathname.slice('/api/diff/'.length)
  if (!rawAgentId || rawAgentId.includes('/')) {
    return null
  }
  return handleSingleDiff(rawAgentId, context)
}
