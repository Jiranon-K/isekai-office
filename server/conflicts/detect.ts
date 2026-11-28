import type { FileConflict } from '@shared/conflicts'
import type { AgentState } from '@shared/types'
import { normalizeTouchedPath } from './touched'

export type AgentTouched = {
  agentId: string
  repo: string | null
  worktree: string | null
  state: AgentState
  updatedAt: number
  paths: string[]
}

type ConflictGroup = {
  repo: string
  path: string
  agentIds: Set<string>
  updatedAt: number
}

function repoKeyFor(entry: AgentTouched): string {
  return entry.repo ?? entry.worktree ?? 'unknown'
}

function compareConflicts(first: FileConflict, second: FileConflict): number {
  if (second.updatedAt !== first.updatedAt) {
    return second.updatedAt - first.updatedAt
  }
  if (first.repo !== second.repo) {
    return first.repo.localeCompare(second.repo)
  }
  return first.path.localeCompare(second.path)
}

export function detectConflicts(entries: AgentTouched[]): FileConflict[] {
  const groups = new Map<string, ConflictGroup>()
  for (const entry of entries) {
    if (entry.state === 'done') {
      continue
    }
    const repo = repoKeyFor(entry)
    for (const rawPath of entry.paths) {
      const normalized = normalizeTouchedPath(rawPath, null)
      if (!normalized) {
        continue
      }
      const key = `${repo}\0${normalized.toLowerCase()}`
      const existing = groups.get(key)
      if (existing) {
        existing.agentIds.add(entry.agentId)
        existing.updatedAt = Math.max(existing.updatedAt, entry.updatedAt)
        continue
      }
      groups.set(key, {
        repo,
        path: normalized,
        agentIds: new Set([entry.agentId]),
        updatedAt: entry.updatedAt
      })
    }
  }
  const conflicts: FileConflict[] = []
  for (const group of groups.values()) {
    if (group.agentIds.size < 2) {
      continue
    }
    conflicts.push({
      repo: group.repo,
      path: group.path,
      agentIds: [...group.agentIds],
      updatedAt: group.updatedAt
    })
  }
  return conflicts.sort(compareConflicts)
}
