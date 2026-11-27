import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { SessionEntry } from '@shared/types'
import { readTail, transcriptFolder } from './transcripts'

const HISTORY_BYTES = 32 * 1024 * 1024
const HISTORY_LIMIT = 200
const HIDDEN_PREFIXES = ['<command-name>', '<local-command-', '<system-reminder>', '<task-notification>']
const PASTE_TAG = /<\/?pasted_content[^>]*>/g

type Block = { type?: string; text?: string; name?: string }

type CacheEntry = { key: string; entries: SessionEntry[] }

const cache = new Map<string, CacheEntry>()

function parseLine(line: string): Record<string, any> | null {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function blocksOf(content: unknown): Block[] {
  return Array.isArray(content) ? content.filter((block) => typeof block === 'object' && block !== null) : []
}

function textOf(content: unknown): string {
  if (typeof content === 'string') {
    return content.replace(PASTE_TAG, '').trim()
  }
  return blocksOf(content)
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => (block.text ?? '').trim())
    .filter(Boolean)
    .join('\n\n')
}

function toolsOf(content: unknown): string[] {
  return blocksOf(content)
    .filter((block) => block.type === 'tool_use' && typeof block.name === 'string')
    .map((block) => block.name ?? '')
}

function isHidden(record: Record<string, any>): boolean {
  return Boolean(record.isMeta || record.isSidechain || record.isCompactSummary)
}

function isHarnessText(text: string): boolean {
  return HIDDEN_PREFIXES.some((prefix) => text.startsWith(prefix))
}

function timeOf(record: Record<string, any>): number | null {
  const at = Date.parse(record.timestamp)
  return Number.isNaN(at) ? null : at
}

function userEntry(record: Record<string, any>): SessionEntry | null {
  const text = textOf(record.message?.content)
  if (text === '' || isHarnessText(text)) {
    return null
  }
  return { role: 'user', text, tools: [], at: timeOf(record) }
}

function assistantEntry(record: Record<string, any>): SessionEntry | null {
  const text = textOf(record.message?.content)
  const tools = toolsOf(record.message?.content)
  if (text === '' && tools.length === 0) {
    return null
  }
  return { role: 'assistant', text, tools, at: timeOf(record) }
}

function toEntry(line: string): SessionEntry | null {
  if (!line.includes('"type":"user"') && !line.includes('"type":"assistant"')) {
    return null
  }
  const record = parseLine(line)
  if (!record || isHidden(record)) {
    return null
  }
  if (record.type === 'user') {
    return userEntry(record)
  }
  return record.type === 'assistant' ? assistantEntry(record) : null
}

function isToolRun(entry: SessionEntry | undefined): entry is SessionEntry {
  return entry !== undefined && entry.role === 'assistant' && entry.text === ''
}

export function mergeToolRuns(entries: SessionEntry[]): SessionEntry[] {
  const merged: SessionEntry[] = []
  for (const entry of entries) {
    const previous = merged.at(-1)
    if (isToolRun(entry) && isToolRun(previous)) {
      merged[merged.length - 1] = { ...previous, tools: [...previous.tools, ...entry.tools], at: entry.at }
      continue
    }
    merged.push(entry)
  }
  return merged
}

export function parseHistory(text: string, limit = HISTORY_LIMIT): SessionEntry[] {
  const entries = text
    .split('\n')
    .map(toEntry)
    .filter((entry) => entry !== null)
  return mergeToolRuns(entries).slice(-limit)
}

export async function sessionHistory(worktree: string, session: string, projectsDir?: string): Promise<SessionEntry[] | null> {
  return historyAt(join(transcriptFolder(worktree, projectsDir), `${session}.jsonl`))
}

export async function historyAt(path: string): Promise<SessionEntry[] | null> {
  const info = await stat(path).catch(() => null)
  if (!info) {
    return null
  }
  const key = `${info.mtimeMs}:${info.size}`
  const cached = cache.get(path)
  if (cached?.key === key) {
    return cached.entries
  }
  const entries = parseHistory(await readTail(path, info.size, HISTORY_BYTES))
  cache.set(path, { key, entries })
  return entries
}
