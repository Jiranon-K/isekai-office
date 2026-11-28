export type ParsedStreamEvent =
  | { kind: 'system'; sessionId: string | null; cwd: string | null }
  | { kind: 'assistant'; text: string; tools: string[]; contextTokens: number | null }
  | { kind: 'control_request'; requestId: string; toolName: string; input: Record<string, unknown>; screen: string }
  | { kind: 'result'; text: string; isError: boolean }
  | { kind: 'ignored' }

const SUMMARY_MAX_LENGTH = 120

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function usageTokens(usage: unknown): number | null {
  if (!isRecord(usage)) {
    return null
  }
  const fields = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']
  let total = 0
  let found = false
  for (const field of fields) {
    const value = usage[field]
    if (typeof value === 'number' && Number.isFinite(value)) {
      total += value
      found = true
    }
  }
  return found ? total : null
}

function summarizeInput(input: Record<string, unknown>): string {
  for (const key of ['command', 'file_path', 'path', 'notebook_path', 'pattern', 'url', 'query']) {
    const value = stringField(input, key)
    if (value) {
      return value.length > SUMMARY_MAX_LENGTH ? `${value.slice(0, SUMMARY_MAX_LENGTH - 1)}…` : value
    }
  }
  const encoded = JSON.stringify(input)
  if (!encoded || encoded === '{}') {
    return ''
  }
  return encoded.length > SUMMARY_MAX_LENGTH ? `${encoded.slice(0, SUMMARY_MAX_LENGTH - 1)}…` : encoded
}

export function claudeStreamArgs(sessionId: string): string[] {
  return [
    '-p',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--verbose',
    '--permission-prompts',
    'host',
    '--session-id',
    sessionId
  ]
}

export function encodeUserPrompt(text: string): string {
  return `${JSON.stringify({ type: 'user', message: { role: 'user', content: text } })}\n`
}

export function encodeControlResponse(requestId: string, allow: boolean, message?: string): string {
  const response = allow
    ? { behavior: 'allow' }
    : { behavior: 'deny', message: message ?? 'Denied from Isekai Office' }
  return `${JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: requestId, response } })}\n`
}

export function encodeInterrupt(requestId: string): string {
  return `${JSON.stringify({ type: 'control_request', request_id: requestId, request: { subtype: 'interrupt' } })}\n`
}

export function formatPermissionScreen(toolName: string, input: Record<string, unknown>): string {
  const detail = summarizeInput(input)
  const heading = detail ? `⏺ ${toolName}(${detail})` : `⏺ ${toolName}`
  return [
    heading,
    '',
    ' Do you want to proceed?',
    ' ❯ 1. Yes',
    '   2. No, deny from Isekai Office (esc)'
  ].join('\n')
}

function parseAssistant(record: Record<string, unknown>): ParsedStreamEvent {
  const message = isRecord(record.message) ? record.message : null
  const content = message?.content
  const texts: string[] = []
  const tools: string[] = []
  if (typeof content === 'string' && content.trim()) {
    texts.push(content.trim())
  } else if (Array.isArray(content)) {
    for (const item of content) {
      if (!isRecord(item)) {
        continue
      }
      if (item.type === 'text' && typeof item.text === 'string' && item.text.trim()) {
        texts.push(item.text.trim())
      }
      if (item.type === 'tool_use' && typeof item.name === 'string' && item.name.trim()) {
        tools.push(item.name.trim())
      }
    }
  }
  return {
    kind: 'assistant',
    text: texts.join('\n\n'),
    tools,
    contextTokens: usageTokens(message?.usage)
  }
}

function parseControlRequest(record: Record<string, unknown>): ParsedStreamEvent {
  const requestId = stringField(record, 'request_id')
  const inner = isRecord(record.request) ? record.request : null
  if (!requestId || !inner) {
    return { kind: 'ignored' }
  }
  const toolName = stringField(inner, 'tool_name') ?? stringField(inner, 'toolName') ?? stringField(inner, 'subtype') ?? 'Tool'
  const input = isRecord(inner.input) ? inner.input : {}
  return {
    kind: 'control_request',
    requestId,
    toolName,
    input,
    screen: formatPermissionScreen(toolName, input)
  }
}

export function parseStreamLine(line: string): ParsedStreamEvent {
  const trimmed = line.trim()
  if (!trimmed) {
    return { kind: 'ignored' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { kind: 'ignored' }
  }
  if (!isRecord(parsed) || typeof parsed.type !== 'string') {
    return { kind: 'ignored' }
  }
  if (parsed.type === 'system') {
    return {
      kind: 'system',
      sessionId: stringField(parsed, 'session_id'),
      cwd: stringField(parsed, 'cwd')
    }
  }
  if (parsed.type === 'assistant') {
    return parseAssistant(parsed)
  }
  if (parsed.type === 'control_request') {
    return parseControlRequest(parsed)
  }
  if (parsed.type === 'result') {
    return {
      kind: 'result',
      text: typeof parsed.result === 'string' ? parsed.result.trim() : '',
      isError: parsed.is_error === true
    }
  }
  return { kind: 'ignored' }
}
