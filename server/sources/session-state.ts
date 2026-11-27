import type { AgentState } from '@shared/types'

type Block = { type?: string; name?: string; text?: string }

type TranscriptRecord = { type: string; isSidechain?: boolean; isMeta?: boolean; message?: { content?: unknown; stop_reason?: string | null } }

const INTERRUPT_PREFIX = '[Request interrupted by user'

function parseRecord(line: string): TranscriptRecord | null {
  if (!line.includes('"type":"user"') && !line.includes('"type":"assistant"')) {
    return null
  }
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function isConversational(record: TranscriptRecord | null): record is TranscriptRecord {
  if (!record || record.isSidechain || record.isMeta) {
    return false
  }
  return record.type === 'user' || record.type === 'assistant'
}

function conversation(lines: string[]): TranscriptRecord[] {
  return lines.map(parseRecord).filter(isConversational)
}

function blocksOf(record: TranscriptRecord): Block[] {
  const content = record.message?.content
  return Array.isArray(content) ? content.filter((block) => typeof block === 'object' && block !== null) : []
}

function toolUses(record: TranscriptRecord): Block[] {
  return blocksOf(record).filter((block) => block.type === 'tool_use')
}

function isToolResult(record: TranscriptRecord): boolean {
  return blocksOf(record).some((block) => block.type === 'tool_result')
}

function isInterrupt(record: TranscriptRecord): boolean {
  const content = record.message?.content
  if (typeof content === 'string') {
    return content.startsWith(INTERRUPT_PREFIX)
  }
  return blocksOf(record).some((block) => typeof block.text === 'string' && block.text.startsWith(INTERRUPT_PREFIX))
}

function endsTurn(record: TranscriptRecord): boolean {
  return toolUses(record).length === 0 && record.message?.stop_reason !== 'tool_use'
}

export function stateFromTail(lines: string[]): AgentState {
  const last = conversation(lines).at(-1)
  if (!last) {
    return 'done'
  }
  if (last.type === 'assistant') {
    return endsTurn(last) ? 'done' : 'working'
  }
  return isInterrupt(last) ? 'done' : 'working'
}

export function toolFromTail(lines: string[]): string | null {
  for (const record of conversation(lines).reverse()) {
    if (record.type === 'user' && !isToolResult(record)) {
      return null
    }
    const name = toolUses(record).at(-1)?.name
    if (record.type === 'assistant' && name) {
      return name
    }
  }
  return null
}
