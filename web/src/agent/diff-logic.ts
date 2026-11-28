import type { AgentDiff, DiffSummary, FileStatus } from '@shared/diff'
import type { OfficeAgent } from '@shared/types'
import type { BadgeProps } from '@/components/badge'

export type DiffViewState =
  | { kind: 'loading' }
  | { kind: 'no_worktree' }
  | { kind: 'error' }
  | { kind: 'empty'; branch: string | null }
  | { kind: 'files'; diff: AgentDiff }

export const STATUS_CODE: Record<FileStatus, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  renamed: 'R',
  untracked: '?'
}

export const STATUS_VARIANT: Record<FileStatus, BadgeProps['variant']> = {
  modified: 'amber',
  added: 'green',
  deleted: 'red',
  renamed: 'blue',
  untracked: 'muted'
}

export function classifyDiffState(
  data: AgentDiff | null,
  loading: boolean,
  fetchError: string | null
): DiffViewState {
  if (fetchError !== null && !loading) {
    return { kind: 'error' }
  }
  if (data === null || (loading && data.error !== null)) {
    return { kind: 'loading' }
  }
  if (data.error === 'no_worktree') {
    return { kind: 'no_worktree' }
  }
  if (data.error !== null) {
    return { kind: 'error' }
  }
  if (data.files.length === 0) {
    return { kind: 'empty', branch: data.branch }
  }
  return { kind: 'files', diff: data }
}

export function formatDiffSummary(summary: DiffSummary | undefined): string | null {
  if (!summary || summary.unavailable) {
    return null
  }
  if (summary.clean || summary.files === 0) {
    return 'ไม่มีไฟล์แก้'
  }
  return `${summary.files} ไฟล์ · +${summary.added} -${summary.removed}`
}

export function indexDiffSummaries(summaries: readonly DiffSummary[]): Map<string, DiffSummary> {
  const map = new Map<string, DiffSummary>()
  for (const summary of summaries) {
    map.set(summary.agentId, summary)
  }
  return map
}

export function summaryIdsKey(agents: readonly OfficeAgent[]): string {
  return agents.map((agent) => agent.id).join(',')
}
