import type { OfficeAgent } from '@shared/types'
import type { Facing, Spot } from './layout'

export type StationId = 'desk' | 'archive' | 'crystal' | 'forge'
export type GroupId = StationId | 'queue' | 'bar'

export const STATION_IDS: readonly StationId[] = ['desk', 'archive', 'crystal', 'forge']

export const STATION_LABELS: Record<StationId, string> = {
  desk: 'โต๊ะเขียนสัญญา',
  archive: 'หอจดหมายเหตุ',
  crystal: 'ลูกแก้วพยากรณ์',
  forge: 'เตาหลอม',
}

export const STATION_LABEL_POSITIONS: Record<StationId, { x: number; y: number }> = {
  desk: { x: 96, y: 138 },
  archive: { x: 112, y: 44 },
  crystal: { x: 552, y: 138 },
  forge: { x: 560, y: 44 },
}

function row(columns: readonly number[], y: number, facing: Facing, seated = false): Spot[] {
  return columns.map((x) => ({ x, y, facing, seated }))
}

export const SPOT_GROUPS: Record<GroupId, readonly Spot[]> = {
  desk: row([3, 5, 7, 9], 11, 'up'),
  archive: row([3, 5, 7, 9, 11], 5, 'up'),
  crystal: [...row([32, 34, 36], 8, 'down'), ...row([32, 34, 36], 11, 'up')],
  forge: row([32, 34, 36, 38], 5, 'up'),
  queue: [...row([17, 18, 19, 20, 21, 22], 6, 'up'), ...row([17, 18, 19, 20, 21, 22], 9, 'up')],
  bar: [...row([25, 27, 29, 31, 33, 35], 17, 'up', true), ...row([24, 26, 28, 30, 32, 34], 20, 'up')],
}

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

export function groupForAgent(agent: Pick<OfficeAgent, 'state' | 'tool'>): GroupId {
  if (agent.state === 'working') {
    return stationForTool(agent.tool)
  }
  if (agent.state === 'done') {
    return 'bar'
  }
  return 'queue'
}

export function isStation(group: GroupId | null): group is StationId {
  return group === 'desk' || group === 'archive' || group === 'crystal' || group === 'forge'
}
