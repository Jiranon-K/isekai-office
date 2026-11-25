import type { MergeRequestFacts, MergeState, PipelineStatus } from '@shared/types'
import { tagStage } from '../web/src/board/release-logic'

const GLAB_TIMEOUT_MS = 10_000
const CONCURRENCY = 6
const OPEN_TTL_MS = 60_000
const MERGED_TTL_MS = 600_000

export type MergeRequestRef = { url: string; host: string; project: string; iid: number }

type CacheEntry = { facts: MergeRequestFacts | null; fetchedAt: number }

type RawMergeRequest = {
  state?: string
  web_url?: string
  merge_commit_sha?: string | null
  squash_commit_sha?: string | null
  head_pipeline?: { status?: string } | null
}

const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<void>>()
const waiting: (() => void)[] = []
let running = 0

export function parseMergeRequestUrl(url: string): MergeRequestRef | null {
  try {
    const parsed = new URL(url)
    const matched = parsed.pathname.match(/^\/(.+?)\/-\/merge_requests\/(\d+)/)
    return matched?.[1] && matched[2] ? { url, host: parsed.host, project: matched[1], iid: Number(matched[2]) } : null
  } catch {
    return null
  }
}

export function isFresh(facts: MergeRequestFacts | null, ageMs: number): boolean {
  if (facts?.state === 'closed') {
    return true
  }
  if (facts?.state === 'merged') {
    return facts.tags.some((tag) => tagStage(tag) === 'production') || ageMs < MERGED_TTL_MS
  }
  return ageMs < OPEN_TTL_MS
}

const PIPELINE_STATUSES: Record<string, PipelineStatus> = {
  success: 'success',
  failed: 'failed',
  running: 'running',
  pending: 'pending',
  created: 'pending',
  preparing: 'pending',
  scheduled: 'pending',
  waiting_for_resource: 'pending',
  canceled: 'canceled',
  canceling: 'canceled',
  skipped: 'skipped'
}

export function toPipelineStatus(status: string | null | undefined): PipelineStatus | null {
  if (!status) {
    return null
  }
  return PIPELINE_STATUSES[status] ?? 'other'
}

export function toMergeState(state: string | undefined): MergeState {
  return state === 'merged' || state === 'closed' ? state : 'opened'
}

async function glabJson<T>(host: string, path: string): Promise<T> {
  const child = Bun.spawn(['glab', 'api', '--hostname', host, path], { stdout: 'pipe', stderr: 'pipe', timeout: GLAB_TIMEOUT_MS })
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  if (code !== 0) {
    throw new Error(stderr.trim() || `glab exited ${code}`)
  }
  return JSON.parse(stdout)
}

async function tagsContaining(ref: MergeRequestRef, sha: string): Promise<string[]> {
  const project = encodeURIComponent(ref.project)
  const refs = await glabJson<{ name: string }[]>(ref.host, `projects/${project}/repository/commits/${sha}/refs?type=tag&per_page=100`)
  return refs.map((entry) => entry.name)
}

async function fetchFacts(ref: MergeRequestRef): Promise<MergeRequestFacts> {
  const project = encodeURIComponent(ref.project)
  const raw = await glabJson<RawMergeRequest>(ref.host, `projects/${project}/merge_requests/${ref.iid}`)
  const state = toMergeState(raw.state)
  const sha = raw.merge_commit_sha ?? raw.squash_commit_sha
  const tags = state === 'merged' && sha ? await tagsContaining(ref, sha) : []
  return { iid: ref.iid, url: raw.web_url ?? ref.url, state, pipeline: toPipelineStatus(raw.head_pipeline?.status), tags }
}

async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (running >= CONCURRENCY) {
    await new Promise<void>((resume) => waiting.push(resume))
  }
  running += 1
  try {
    return await task()
  } finally {
    running -= 1
    waiting.shift()?.()
  }
}

async function refresh(url: string): Promise<void> {
  const ref = parseMergeRequestUrl(url)
  const previous = cache.get(url)?.facts ?? null
  if (!ref) {
    cache.set(url, { facts: null, fetchedAt: Date.now() })
    return
  }
  try {
    cache.set(url, { facts: await limited(() => fetchFacts(ref)), fetchedAt: Date.now() })
  } catch (error) {
    console.error(`gitlab ${url}: ${error instanceof Error ? error.message : String(error)}`)
    cache.set(url, { facts: previous, fetchedAt: Date.now() })
  }
}

function refreshOnce(url: string): Promise<void> {
  const existing = inFlight.get(url)
  if (existing) {
    return existing
  }
  const started = refresh(url).finally(() => inFlight.delete(url))
  inFlight.set(url, started)
  return started
}

export async function mergeRequestFacts(urls: string[]): Promise<Map<string, MergeRequestFacts>> {
  const unique = [...new Set(urls)]
  const now = Date.now()
  const cold = unique.filter((url) => !cache.has(url))
  for (const url of unique) {
    const entry = cache.get(url)
    if (entry && !isFresh(entry.facts, now - entry.fetchedAt)) {
      void refreshOnce(url)
    }
  }
  await Promise.all(cold.map(refreshOnce))
  const facts = new Map<string, MergeRequestFacts>()
  for (const url of unique) {
    const entry = cache.get(url)
    if (entry?.facts) {
      facts.set(url, entry.facts)
    }
  }
  return facts
}
