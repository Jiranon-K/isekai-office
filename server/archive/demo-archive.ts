import type { ArchiveListResponse, ArchivedSession } from '@shared/archive'
import type { SessionDetail, SessionEntry } from '@shared/types'
import { filterArchiveSessions, type ArchiveQuery } from './scan'

const HOUR = 60 * 60 * 1000

type DemoArchiveEntry = {
  id: string
  title: string
  repo: string
  hoursAgo: number
  size: number
  firstPrompt: string
  assistantReply: string
  tools: string[]
  closingSummary: string
}

const DEMO_ARCHIVE_ENTRIES: DemoArchiveEntry[] = [
  {
    id: 'arch-1',
    title: 'APP-8 checkout coupon validation',
    repo: 'web-app',
    hoursAgo: 2,
    size: 48_200,
    firstPrompt: 'Add coupon code validation to the checkout form with inline error messages and unit tests for expired codes.',
    assistantReply: 'I will inspect the checkout form and cart reducer, then wire coupon validation with tests.',
    tools: ['Read', 'Edit', 'Write', 'Bash'],
    closingSummary: 'Added inline coupon validation and unit tests covering expired, invalid, and stacked codes.'
  },
  {
    id: 'arch-2',
    title: 'API-15 rate limiter middleware',
    repo: 'api',
    hoursAgo: 5,
    size: 63_400,
    firstPrompt: 'Implement sliding-window rate limiting middleware for public API routes returning 429 with Retry-After headers.',
    assistantReply: 'Checking existing middleware pipeline and route registration before adding the rate limiter.',
    tools: ['Read', 'Grep', 'Edit', 'Bash'],
    closingSummary: 'Shipped sliding-window rate limiter with per-IP buckets, Retry-After headers, and burst tests.'
  },
  {
    id: 'arch-3',
    title: 'INFRA-4 staging TLS cert renewal',
    repo: 'infra',
    hoursAgo: 18,
    size: 29_100,
    firstPrompt: 'Audit the staging ingress TLS renewal script and add a preflight check that alerts 14 days before expiry.',
    assistantReply: 'Reading the renewal scripts and staging ingress manifest to find where expiry checks belong.',
    tools: ['Read', 'Edit', 'Bash'],
    closingSummary: 'Updated renewal cron script with 14-day expiry preflight verification and dry-run test.'
  },
  {
    id: 'arch-4',
    title: 'DOCS-11 webhook authentication guide',
    repo: 'docs',
    hoursAgo: 26,
    size: 19_800,
    firstPrompt: 'Write the webhook HMAC signature verification guide with Bun and Node examples and replay-window notes.',
    assistantReply: 'Checking the current webhook signing implementation so every code sample matches production headers.',
    tools: ['Read', 'Write'],
    closingSummary: 'Published webhook signature verification guide with timing-safe comparison examples.'
  },
  {
    id: 'arch-5',
    title: 'APP-5 keyboard navigation audit',
    repo: 'web-app',
    hoursAgo: 46,
    size: 54_900,
    firstPrompt: 'Audit modal and popover focus traps across room panels and fix Escape key handling so focus returns to the trigger.',
    assistantReply: 'Reviewing popover wrappers and keyboard handlers to make sure focus returns cleanly on close.',
    tools: ['Grep', 'Read', 'Edit', 'Bash'],
    closingSummary: 'Fixed Escape handling and focus restoration across all room panel modals.'
  }
]

export function demoArchiveList(query: ArchiveQuery, activeIds: ReadonlySet<string>, now = Date.now()): ArchiveListResponse {
  const sessions: ArchivedSession[] = DEMO_ARCHIVE_ENTRIES.map((item) => ({
    id: item.id,
    title: item.title,
    repo: item.repo,
    modifiedAt: now - item.hoursAgo * HOUR,
    size: item.size,
    active: activeIds.has(item.id)
  }))
  return filterArchiveSessions(sessions, query)
}

export function demoArchiveSession(id: string, now = Date.now()): SessionDetail | null {
  const item = DEMO_ARCHIVE_ENTRIES.find((candidate) => candidate.id === id)
  if (!item) {
    return null
  }
  const finishedAt = now - item.hoursAgo * HOUR
  const entries: SessionEntry[] = [
    { role: 'user', text: item.firstPrompt, tools: [], at: finishedAt - 20 * 60_000 },
    { role: 'assistant', text: item.assistantReply, tools: [], at: finishedAt - 19 * 60_000 },
    { role: 'assistant', text: '', tools: item.tools, at: finishedAt - 10 * 60_000 },
    { role: 'assistant', text: item.closingSummary, tools: [], at: finishedAt }
  ]
  return { id: item.id, entries, screen: null }
}
