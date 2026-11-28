const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const DEFAULT_TOUCHED_LIMIT = 50
const WINDOWS_DRIVE = /^[a-zA-Z]:\//

type ToolUseBlock = {
  type?: unknown
  name?: unknown
  input?: unknown
}

type AssistantRecord = {
  type?: unknown
  message?: { content?: unknown }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeSlashes(rawPath: string): string {
  return rawPath.trim().replace(/\\/g, '/').replace(/\/+/g, '/')
}

export function normalizeTouchedPath(rawPath: string, worktree: string | null): string | null {
  let normalized = normalizeSlashes(rawPath)
  if (!normalized) {
    return null
  }
  if (worktree) {
    const cleanWorktree = normalizeSlashes(worktree).replace(/\/$/, '')
    if (cleanWorktree) {
      const prefix = `${cleanWorktree}/`
      const caseInsensitive = WINDOWS_DRIVE.test(prefix)
      const matches = caseInsensitive
        ? normalized.toLowerCase().startsWith(prefix.toLowerCase())
        : normalized.startsWith(prefix)
      if (matches) {
        normalized = normalized.slice(prefix.length)
      }
    }
  }
  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2)
  }
  return normalized || null
}

function pathFromToolInput(input: unknown): string | null {
  if (!isRecord(input)) {
    return null
  }
  for (const field of ['file_path', 'path', 'notebook_path']) {
    const value = input[field]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }
  return null
}

function parseAssistantRecord(line: string): AssistantRecord | null {
  if (!line.includes('"tool_use"')) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(line)
    if (!isRecord(parsed) || parsed.type !== 'assistant') {
      return null
    }
    return parsed as AssistantRecord
  } catch {
    return null
  }
}

function rawPathsFromLine(line: string): string[] {
  const record = parseAssistantRecord(line)
  const content = record?.message?.content
  if (!Array.isArray(content)) {
    return []
  }
  const paths: string[] = []
  for (const item of content) {
    if (!isRecord(item)) {
      continue
    }
    const block = item as ToolUseBlock
    if (block.type !== 'tool_use' || typeof block.name !== 'string' || !WRITE_TOOLS.has(block.name)) {
      continue
    }
    const rawPath = pathFromToolInput(block.input)
    if (rawPath !== null) {
      paths.push(rawPath)
    }
  }
  return paths
}

export function extractTouchedPaths(lines: string[], worktree: string | null, limit = DEFAULT_TOUCHED_LIMIT): string[] {
  if (limit <= 0) {
    return []
  }
  const latestByKey = new Map<string, string>()
  for (const line of lines) {
    for (const rawPath of rawPathsFromLine(line)) {
      const normalized = normalizeTouchedPath(rawPath, worktree)
      if (!normalized) {
        continue
      }
      const key = normalized.toLowerCase()
      if (latestByKey.has(key)) {
        latestByKey.delete(key)
      }
      latestByKey.set(key, normalized)
    }
  }
  const all = [...latestByKey.values()]
  return all.length > limit ? all.slice(-limit) : all
}
