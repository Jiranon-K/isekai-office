import type { OrderPreset } from './orders'

export const RULE_MAX_LENGTH = 200

export const TOOL_NAMES = [
  'Agent',
  'Bash',
  'Edit',
  'Glob',
  'Grep',
  'LSP',
  'Monitor',
  'NotebookEdit',
  'PowerShell',
  'Read',
  'Skill',
  'WebFetch',
  'WebSearch',
  'Write'
]

export const PICKABLE_TOOLS = ['Bash', 'PowerShell', 'Read', 'Edit', 'Write', 'WebFetch', 'WebSearch', 'Glob', 'Grep']

export const ORDER_PRESETS: OrderPreset[] = [
  { label: 'bun run check', rule: 'Bash(bun run check)' },
  { label: 'bun test', rule: 'Bash(bun test)' },
  { label: 'bun run typecheck', rule: 'Bash(bun run typecheck)' },
  { label: 'npm test', rule: 'Bash(npm test)' },
  { label: 'git status', rule: 'Bash(git status)' },
  { label: 'git diff', rule: 'Bash(git diff *)' },
  { label: 'git log', rule: 'Bash(git log *)' }
]

const BROAD_BARE_TOOLS = ['Bash', 'Write', 'Edit']

const SHELL_TOOLS = ['Bash', 'PowerShell']

const RISKY_COMMANDS = [
  'rm',
  'sudo',
  'git push',
  'git reset',
  'git clean',
  'curl',
  'wget',
  'chmod',
  'chown',
  'dd',
  'sh',
  'bash',
  'eval',
  'powershell',
  'cmd',
  'del'
]

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

const RULE_SHAPE = /^([A-Za-z][A-Za-z0-9_-]*)(?:\((.*)\))?$/

const MCP_TOOL = /^mcp__[A-Za-z0-9_-]+$/

const COMMAND_END = /[\s:*]/

export type ParsedRule = { tool: string; specifier: string | null }

function isKnownTool(tool: string, hasSpecifier: boolean): boolean {
  if (TOOL_NAMES.includes(tool)) {
    return true
  }
  return !hasSpecifier && MCP_TOOL.test(tool)
}

export function parseRule(rule: string): ParsedRule | null {
  const match = RULE_SHAPE.exec(rule)
  if (!match) {
    return null
  }
  const tool = match[1] ?? ''
  const specifier = match[2] ?? null
  if (specifier !== null && specifier.trim() === '') {
    return null
  }
  return isKnownTool(tool, specifier !== null) ? { tool, specifier } : null
}

export function toRule(text: string): string | null {
  if (text.length > RULE_MAX_LENGTH || CONTROL_CHARACTERS.test(text)) {
    return null
  }
  const rule = text.trim()
  return parseRule(rule) ? rule : null
}

function isOnlyWildcard(specifier: string): boolean {
  return /^[\s*:]*$/.test(specifier)
}

function startsWithCommand(command: string, risky: string): boolean {
  if (!command.startsWith(risky)) {
    return false
  }
  const next = command.charAt(risky.length)
  return next === '' || COMMAND_END.test(next)
}

function startsWithRiskyCommand(specifier: string): boolean {
  const command = specifier.trim().toLowerCase().replace(/\s+/g, ' ')
  if (command.startsWith('*')) {
    return true
  }
  return RISKY_COMMANDS.some((risky) => startsWithCommand(command, risky))
}

export function isTooBroad(rule: string): boolean {
  const parsed = parseRule(rule)
  if (!parsed) {
    return false
  }
  if (parsed.specifier === null) {
    return BROAD_BARE_TOOLS.includes(parsed.tool)
  }
  if (isOnlyWildcard(parsed.specifier)) {
    return true
  }
  return SHELL_TOOLS.includes(parsed.tool) && startsWithRiskyCommand(parsed.specifier)
}

export function buildRule(tool: string, pattern: string): string {
  const specifier = pattern.trim()
  return specifier ? `${tool}(${specifier})` : tool
}
