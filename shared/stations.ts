export type StationId = 'desk' | 'archive' | 'crystal' | 'forge'

const DESK_TOOLS: ReadonlySet<string> = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const ARCHIVE_TOOLS: ReadonlySet<string> = new Set(['Read', 'Grep', 'Glob', 'LS'])
const CRYSTAL_TOOLS: ReadonlySet<string> = new Set([
  'WebSearch',
  'WebFetch',
  'ToolSearch',
  'TodoWrite',
  'Agent',
  'Task',
  'Skill',
  'AskUserQuestion',
])
const CRYSTAL_PREFIXES: readonly string[] = ['mcp__notion', 'mcp__claude_ai_']

function isWorkspaceTool(tool: string): boolean {
  return tool.startsWith('mcp__') && tool.includes('workspace')
}

export function stationForTool(tool: string | null): StationId {
  if (!tool) {
    return 'forge'
  }
  if (DESK_TOOLS.has(tool)) {
    return 'desk'
  }
  if (ARCHIVE_TOOLS.has(tool)) {
    return 'archive'
  }
  if (CRYSTAL_TOOLS.has(tool) || isWorkspaceTool(tool) || CRYSTAL_PREFIXES.some((prefix) => tool.startsWith(prefix))) {
    return 'crystal'
  }
  return 'forge'
}
