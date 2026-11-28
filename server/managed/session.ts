import type { AgentState, OfficeAgent, SessionDetail, SessionEntry } from '@shared/types'
import { baseNameOf } from '../sources/local-facts'
import type { ParsedStreamEvent } from './protocol'

export const MANAGED_TERMINAL_PREFIX = 'managed:'

const MAX_SCREEN_LINES = 40
const MAX_SCREEN_BYTES = 4 * 1024
const MAX_ENTRIES = 200

export type ManagedProcess = {
  write(chunk: string): boolean
  kill(): void
  stdout: ReadableStream<Uint8Array> | null
  stderr: ReadableStream<Uint8Array> | null
  exited: Promise<number>
}

export type ManagedSession = {
  id: string
  sessionId: string
  title: string
  repo: string
  worktree: string
  state: AgentState
  tool: string | null
  lastMessage: string | null
  contextTokens: number | null
  updatedAt: number
  activeAt: number
  pendingRequestId: string | null
  screenLines: string[]
  entries: SessionEntry[]
  process: ManagedProcess | null
  exitedAt: number | null
}

export function managedIdFromTerminal(terminal: string | null): string | null {
  if (!terminal || !terminal.startsWith(MANAGED_TERMINAL_PREFIX)) {
    return null
  }
  const id = terminal.slice(MANAGED_TERMINAL_PREFIX.length)
  return id.length > 0 ? id : null
}

export function appendScreenLines(current: string[], text: string): string[] {
  const incoming = text.replace(/\r\n/g, '\n').split('\n')
  const combined = [...current, ...incoming].slice(-MAX_SCREEN_LINES)
  while (combined.length > 1 && Buffer.byteLength(combined.join('\n'), 'utf8') > MAX_SCREEN_BYTES) {
    combined.shift()
  }
  if (combined.length === 1 && Buffer.byteLength(combined[0] ?? '', 'utf8') > MAX_SCREEN_BYTES) {
    combined[0] = (combined[0] ?? '').slice(-MAX_SCREEN_BYTES)
  }
  return combined
}

export function appendSessionEntry(entries: SessionEntry[], entry: SessionEntry): SessionEntry[] {
  const next = [...entries, entry]
  return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next
}

export async function consumeStreamLines(stream: ReadableStream<Uint8Array> | null, onLine: (line: string) => void): Promise<void> {
  if (!stream) {
    return
  }
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      pending += decoder.decode(value, { stream: true })
      const parts = pending.split('\n')
      pending = parts.pop() ?? ''
      for (const part of parts) {
        onLine(part)
      }
    }
    const tail = `${pending}${decoder.decode()}`.trim()
    if (tail) {
      onLine(tail)
    }
  } catch {
    return
  } finally {
    reader.releaseLock()
  }
}

export function applyStreamEvent(session: ManagedSession, event: ParsedStreamEvent, stamp: number): boolean {
  if (event.kind === 'ignored') {
    return false
  }
  if (event.kind === 'system') {
    if (event.sessionId) {
      session.sessionId = event.sessionId
    }
    if (event.cwd) {
      session.worktree = event.cwd
      session.repo = baseNameOf(event.cwd) ?? session.repo
    }
    session.updatedAt = stamp
    return true
  }
  if (event.kind === 'assistant') {
    if (event.contextTokens !== null) {
      session.contextTokens = event.contextTokens
    }
    if (event.tools.length > 0) {
      session.tool = event.tools.at(-1) ?? session.tool
      session.state = 'working'
    }
    if (event.text) {
      session.lastMessage = event.text
      session.screenLines = appendScreenLines(session.screenLines, event.text)
    }
    if (event.text || event.tools.length > 0) {
      session.entries = appendSessionEntry(session.entries, { role: 'assistant', text: event.text, tools: event.tools, at: stamp })
    }
    session.updatedAt = stamp
    session.activeAt = stamp
    return true
  }
  if (event.kind === 'control_request') {
    session.state = 'waiting'
    session.tool = event.toolName
    session.pendingRequestId = event.requestId
    session.lastMessage = `Allow ${event.toolName}?`
    session.screenLines = appendScreenLines(session.screenLines, event.screen)
    session.updatedAt = stamp
    session.activeAt = stamp
    return true
  }
  session.state = 'done'
  session.tool = null
  session.pendingRequestId = null
  if (event.text) {
    session.lastMessage = event.text
    session.screenLines = appendScreenLines(session.screenLines, event.text)
  }
  session.updatedAt = stamp
  session.activeAt = stamp
  return true
}

export function sessionToAgent(session: ManagedSession): OfficeAgent {
  return {
    id: session.id,
    title: session.title,
    repo: session.repo,
    workspace: null,
    worktree: session.worktree,
    session: session.sessionId,
    contextTokens: session.contextTokens,
    state: session.state,
    tool: session.state === 'done' ? null : session.tool,
    lastMessage: session.lastMessage,
    updatedAt: session.updatedAt,
    activeAt: session.activeAt,
    terminal: session.process ? `${MANAGED_TERMINAL_PREFIX}${session.id}` : null
  }
}

export function sessionToDetail(session: ManagedSession): SessionDetail {
  return {
    id: session.id,
    entries: [...session.entries],
    screen: session.screenLines.length > 0 ? session.screenLines.join('\n') : null
  }
}
