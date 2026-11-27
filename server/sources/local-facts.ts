import { parseTranscriptTail } from './transcripts'

export type LocalFacts = { cwd: string | null; title: string | null; contextTokens: number | null }

const TITLE_FIELDS: [type: string, field: string][] = [
  ['custom-title', 'customTitle'],
  ['ai-title', 'aiTitle'],
  ['agent-name', 'agentName']
]

export function baseNameOf(path: string): string | null {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? null
}

function parseLine(line: string): Record<string, unknown> | null {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function lastStringField(lines: string[], needle: string, type: string | null, field: string): string | null {
  for (const line of [...lines].reverse()) {
    if (!line.includes(needle)) {
      continue
    }
    const parsed = parseLine(line)
    const value = parsed?.[field]
    if ((type === null || parsed?.type === type) && typeof value === 'string' && value.trim() !== '') {
      return value.trim()
    }
  }
  return null
}

function titleFrom(lines: string[]): string | null {
  for (const [type, field] of TITLE_FIELDS) {
    const found = lastStringField(lines, `"${type}"`, type, field)
    if (found) {
      return found
    }
  }
  return null
}

export function localFacts(lines: string[]): LocalFacts {
  const cwd = lastStringField(lines, '"cwd"', null, 'cwd')
  const title = titleFrom(lines) ?? (cwd ? baseNameOf(cwd) : null)
  return { cwd, title, contextTokens: parseTranscriptTail(lines.join('\n')).contextTokens }
}
