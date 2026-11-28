import type { OfficeAgent } from '@shared/types'
import { demoArchiveList, demoArchiveSession } from './demo-archive'
import { clampArchiveLimit, createArchiveScanner, isValidArchiveId, type ArchiveScanner } from './scan'

export type ArchiveRouteContext = {
  demo: boolean
  agents(): OfficeAgent[]
  scanner?: ArchiveScanner
  now?: () => number
}

const defaultScanner = createArchiveScanner()

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function activeSessionIds(agents: OfficeAgent[]): Set<string> {
  const ids = new Set<string>()
  for (const agent of agents) {
    ids.add(agent.id)
    if (agent.session) {
      ids.add(agent.session)
    }
  }
  return ids
}

async function handleArchiveList(url: URL, context: ArchiveRouteContext): Promise<Response> {
  const query = {
    q: url.searchParams.get('q') ?? '',
    repo: url.searchParams.get('repo') ?? '',
    limit: clampArchiveLimit(url.searchParams.get('limit'))
  }
  const activeIds = activeSessionIds(context.agents())
  if (context.demo) {
    return json(demoArchiveList(query, activeIds, (context.now ?? Date.now)()))
  }
  const scanner = context.scanner ?? defaultScanner
  return json(await scanner.list(query, activeIds))
}

async function handleArchiveDetail(rawId: string, context: ArchiveRouteContext): Promise<Response> {
  if (!rawId || rawId.includes('/')) {
    return json({ error: 'bad_request' }, 400)
  }
  let id: string
  try {
    id = decodeURIComponent(rawId)
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  if (!isValidArchiveId(id)) {
    return json({ error: 'bad_request' }, 400)
  }
  const detail = context.demo
    ? demoArchiveSession(id, (context.now ?? Date.now)())
    : await (context.scanner ?? defaultScanner).readSession(id)
  if (!detail) {
    return json({ error: 'session_not_found' }, 404)
  }
  return json(detail)
}

export async function handleArchive(request: Request, context: ArchiveRouteContext): Promise<Response | null> {
  if (request.method !== 'GET') {
    return null
  }
  const url = new URL(request.url)
  if (url.pathname === '/api/archive') {
    return handleArchiveList(url, context)
  }
  if (!url.pathname.startsWith('/api/archive/')) {
    return null
  }
  return handleArchiveDetail(url.pathname.slice('/api/archive/'.length), context)
}
