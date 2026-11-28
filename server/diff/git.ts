import { homedir } from 'node:os'
import { isAbsolute } from 'node:path'
import type { AgentDiff, ChangedFile, FileStatus } from '@shared/diff'
import { isHomeOrRoot } from '../sources/permissions'

export const GIT_TIMEOUT_MS = 3_000
export const MAX_DIFF_FILES = 100

export type GitRunResult = { ok: boolean; stdout: string }

export type GitRunner = (args: string[], worktree: string, timeoutMs: number) => Promise<GitRunResult>

export type ReadDiffOptions = {
  home?: string
  runGit?: GitRunner
  timeoutMs?: number
}

type LineCounts = { added: number; removed: number }
type StatusEntry = { path: string; status: FileStatus }

function emptyDiff(agentId: string, error: string | null): AgentDiff {
  return {
    agentId,
    branch: null,
    files: [],
    totalAdded: 0,
    totalRemoved: 0,
    truncated: false,
    error
  }
}

function stripQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1)
  }
  return value
}

function parseBranchHeader(line: string): string | null {
  const header = line.slice(3).trim()
  if (!header || header.startsWith('HEAD (no branch)')) {
    return null
  }
  const prefix = header.startsWith('No commits yet on ')
    ? 'No commits yet on '
    : header.startsWith('Initial commit on ')
      ? 'Initial commit on '
      : null
  const target = prefix ? header.slice(prefix.length) : header
  const beforeTracking = target.split('...')[0] ?? ''
  const branch = beforeTracking.split(' ')[0]?.trim() ?? ''
  return branch.length > 0 ? branch : null
}

function statusFromCode(indexCode: string, worktreeCode: string): FileStatus {
  if (indexCode === '?' && worktreeCode === '?') {
    return 'untracked'
  }
  if (indexCode === 'R' || worktreeCode === 'R') {
    return 'renamed'
  }
  if (indexCode === 'D' || worktreeCode === 'D') {
    return 'deleted'
  }
  if (indexCode === 'A' || worktreeCode === 'A') {
    return 'added'
  }
  return 'modified'
}

function extractPorcelainPath(rawPath: string, status: FileStatus): string {
  if (status === 'renamed') {
    const arrowIndex = rawPath.indexOf(' -> ')
    if (arrowIndex !== -1) {
      return stripQuotes(rawPath.slice(arrowIndex + 4))
    }
  }
  return stripQuotes(rawPath)
}

export function parsePorcelainStatus(stdout: string): { branch: string | null; entries: StatusEntry[] } {
  let branch: string | null = null
  const entries: StatusEntry[] = []
  const seen = new Set<string>()
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (line.startsWith('## ')) {
      branch = parseBranchHeader(line)
      continue
    }
    if (line.length < 4) {
      continue
    }
    const indexCode = line[0] ?? ' '
    const worktreeCode = line[1] ?? ' '
    if (indexCode === '!' && worktreeCode === '!') {
      continue
    }
    const status = statusFromCode(indexCode, worktreeCode)
    const path = extractPorcelainPath(line.slice(3), status)
    if (path.length === 0 || seen.has(path)) {
      continue
    }
    seen.add(path)
    entries.push({ path, status })
  }
  return { branch, entries }
}

function normalizeNumstatPath(rawPath: string): string {
  const unquoted = stripQuotes(rawPath.trim())
  if (unquoted.includes('{') && unquoted.includes(' => ')) {
    return unquoted.replace(/\{[^{}]* => ([^{}]*)\}/g, '$1').replace(/\/+/g, '/').replace(/^\//, '')
  }
  const arrowIndex = unquoted.indexOf(' => ')
  if (arrowIndex !== -1) {
    return stripQuotes(unquoted.slice(arrowIndex + 4))
  }
  return unquoted
}

function parseLineNumber(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export function parseNumstat(stdout: string): Map<string, LineCounts> {
  const counts = new Map<string, LineCounts>()
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (!line) {
      continue
    }
    const parts = line.split('\t')
    if (parts.length < 3) {
      continue
    }
    const added = parseLineNumber(parts[0] ?? '')
    const removed = parseLineNumber(parts[1] ?? '')
    const path = normalizeNumstatPath(parts.slice(2).join('\t'))
    if (!path) {
      continue
    }
    const existing = counts.get(path)
    counts.set(path, {
      added: (existing?.added ?? 0) + added,
      removed: (existing?.removed ?? 0) + removed
    })
  }
  return counts
}

export function mergeLineCounts(first: Map<string, LineCounts>, second: Map<string, LineCounts>): Map<string, LineCounts> {
  const merged = new Map<string, LineCounts>(first)
  for (const [path, delta] of second) {
    const existing = merged.get(path)
    merged.set(path, {
      added: (existing?.added ?? 0) + delta.added,
      removed: (existing?.removed ?? 0) + delta.removed
    })
  }
  return merged
}

export function buildAgentDiff(agentId: string, statusOutput: string, unstagedOutput: string, cachedOutput: string): AgentDiff {
  const { branch, entries } = parsePorcelainStatus(statusOutput)
  const counts = mergeLineCounts(parseNumstat(unstagedOutput), parseNumstat(cachedOutput))
  let totalAdded = 0
  let totalRemoved = 0
  const allFiles: ChangedFile[] = entries.map((entry) => {
    const lineCounts = counts.get(entry.path) ?? { added: 0, removed: 0 }
    totalAdded += lineCounts.added
    totalRemoved += lineCounts.removed
    return {
      path: entry.path,
      status: entry.status,
      added: lineCounts.added,
      removed: lineCounts.removed
    }
  })
  const truncated = allFiles.length > MAX_DIFF_FILES
  const files = truncated ? allFiles.slice(0, MAX_DIFF_FILES) : allFiles
  return {
    agentId,
    branch,
    files,
    totalAdded,
    totalRemoved,
    truncated,
    error: null
  }
}

export async function runGitCommand(args: string[], worktree: string, timeoutMs: number): Promise<GitRunResult> {
  try {
    const child = Bun.spawn(['git', '-c', 'core.quotepath=false', ...args], {
      cwd: worktree,
      stdout: 'pipe',
      stderr: 'ignore',
      timeout: timeoutMs
    })
    const [stdout, exitCode] = await Promise.all([new Response(child.stdout).text(), child.exited])
    return { ok: exitCode === 0 && child.signalCode === null, stdout }
  } catch {
    return { ok: false, stdout: '' }
  }
}

export async function readGitDiff(agentId: string, worktree: string, options: ReadDiffOptions = {}): Promise<AgentDiff> {
  const home = options.home ?? homedir()
  if (!isAbsolute(worktree) || isHomeOrRoot(worktree, home)) {
    return emptyDiff(agentId, 'not_a_repo')
  }
  const runGit = options.runGit ?? runGitCommand
  const timeoutMs = options.timeoutMs ?? GIT_TIMEOUT_MS
  const [statusResult, unstagedResult, cachedResult] = await Promise.all([
    runGit(['status', '--porcelain=v1', '-b'], worktree, timeoutMs),
    runGit(['diff', '--numstat'], worktree, timeoutMs),
    runGit(['diff', '--cached', '--numstat'], worktree, timeoutMs)
  ])
  if (!statusResult.ok || !unstagedResult.ok || !cachedResult.ok) {
    return emptyDiff(agentId, 'git_unavailable')
  }
  return buildAgentDiff(agentId, statusResult.stdout, unstagedResult.stdout, cachedResult.stdout)
}
