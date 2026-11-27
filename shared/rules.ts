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

export const PICKABLE_TOOLS = ['Bash', 'PowerShell', 'Read', 'Edit', 'WebFetch', 'WebSearch']

export const ORDER_PRESETS: OrderPreset[] = [
  { label: 'bun run check', rule: 'Bash(bun run check)' },
  { label: 'bun test', rule: 'Bash(bun test)' },
  { label: 'bun run typecheck', rule: 'Bash(bun run typecheck)' },
  { label: 'npm test', rule: 'Bash(npm test)' },
  { label: 'git status', rule: 'Bash(git status)' },
  { label: 'git diff', rule: 'Bash(git diff *)' },
  { label: 'git log', rule: 'Bash(git log *)' }
]

const BROAD_BARE_TOOLS = ['Bash', 'PowerShell', 'Write', 'Edit', 'NotebookEdit', 'WebFetch', 'Read', 'Agent', 'Skill']

const SHELL_TOOLS = ['Bash', 'PowerShell']

const FILE_WRITE_TOOLS = ['Edit', 'Write', 'NotebookEdit']

const RISKY_COMMANDS = [
  'rm',
  'sudo',
  'curl',
  'wget',
  'chmod',
  'chown',
  'dd',
  'sh',
  'bash',
  'zsh',
  'fish',
  'ksh',
  'dash',
  'env',
  'xargs',
  'nc',
  'ssh',
  'npx',
  'node',
  'python',
  'perl',
  'ruby',
  'bunx',
  'deno',
  'php',
  'eval',
  'powershell',
  'pwsh',
  'cmd',
  'del',
  'find',
  'iex',
  'invoke-expression',
  'remove-item'
]

const COMMAND_WRAPPERS = ['time', 'nohup', 'exec', 'command', 'builtin', 'nice']

const VARIABLE_ASSIGNMENT = /^[a-z_][a-z0-9_]*=/

const SHELL_OPERATOR = /[|;&`<>]|\$\(/

const RISKY_GIT_SUBCOMMANDS = ['push', 'reset', 'clean']

const PROTECTED_FOLDERS = ['.claude', '.git']

const SECRET_FOLDERS = ['.ssh', '.aws', '.gnupg']

const ALL_GLOB_PATH = /^(?:\/\/|\/|~\/|\.\/)?(?:\*+\/?)*$/

const NOT_PRINTABLE_ASCII = /[^\u0020-\u007e]/

const IGNORED_FIELD_PREFIX = /^(?:command|file_path|notebook_path|url|path):/

const PATHLESS_TOOLS = ['Write', 'Glob', 'Grep', 'NotebookEdit']

const RULE_SHAPE = /^([A-Za-z][A-Za-z0-9_-]*)(?:\((.*)\))?$/

const MCP_TOOL = /^mcp__[A-Za-z0-9_-]+$/

export type ParsedRule = { tool: string; specifier: string | null }

function isKnownTool(tool: string, hasSpecifier: boolean): boolean {
  if (TOOL_NAMES.includes(tool)) {
    return true
  }
  return !hasSpecifier && MCP_TOOL.test(tool)
}

function isIgnoredSpecifier(tool: string, specifier: string): boolean {
  const trimmed = specifier.trim()
  if (IGNORED_FIELD_PREFIX.test(trimmed) || trimmed.includes(')(')) {
    return true
  }
  return PATHLESS_TOOLS.includes(tool) && trimmed !== '*'
}

export function parseRule(rule: string): ParsedRule | null {
  const match = RULE_SHAPE.exec(rule)
  if (!match) {
    return null
  }
  const tool = match[1] ?? ''
  const specifier = match[2] ?? null
  if (specifier !== null && (specifier.trim() === '' || isIgnoredSpecifier(tool, specifier))) {
    return null
  }
  return isKnownTool(tool, specifier !== null) ? { tool, specifier } : null
}

export function toRule(text: string): string | null {
  if (text.length > RULE_MAX_LENGTH || NOT_PRINTABLE_ASCII.test(text)) {
    return null
  }
  const rule = text.trim()
  return parseRule(rule) ? rule : null
}

function isOnlyWildcard(specifier: string): boolean {
  return /^[\s*:]*$/.test(specifier)
}

function commandWords(specifier: string): string[] {
  return specifier.trim().toLowerCase().replace(/:\*$/, ' *').split(/\s+/)
}

function commandName(word: string): string {
  const basename = word.split(/[\\/]/).pop() ?? ''
  return basename.replace(/\.(exe|cmd|bat|ps1)$/, '')
}

function isRiskyName(name: string): boolean {
  return RISKY_COMMANDS.includes(name) || /^python[\d.]*$/.test(name)
}

function isBroadGit(words: string[]): boolean {
  const subcommand = words[1]
  if (subcommand === undefined) {
    return false
  }
  return subcommand.includes('*') || subcommand.startsWith('-') || RISKY_GIT_SUBCOMMANDS.includes(subcommand)
}

function isCommandPrefix(word: string): boolean {
  return VARIABLE_ASSIGNMENT.test(word) || COMMAND_WRAPPERS.includes(commandName(word))
}

function withoutCommandPrefixes(words: string[]): string[] {
  const start = words.findIndex((word) => !isCommandPrefix(word))
  return start === -1 ? [] : words.slice(start)
}

function chainsCommands(specifier: string): boolean {
  return specifier.includes('*') && SHELL_OPERATOR.test(specifier)
}

function isBroadShellCommand(specifier: string): boolean {
  if (chainsCommands(specifier)) {
    return true
  }
  const words = withoutCommandPrefixes(commandWords(specifier))
  const first = words[0] ?? ''
  if (first === '' || first.includes('*')) {
    return true
  }
  const name = commandName(first)
  if (isRiskyName(name)) {
    return true
  }
  if (name === 'bun') {
    return words[1] === 'x'
  }
  return name === 'git' && (first !== 'git' || isBroadGit(words))
}

function pathSegments(specifier: string): string[] {
  return specifier.trim().toLowerCase().replace(/\\/g, '/').split('/')
}

function reachesFolder(specifier: string, folders: string[]): boolean {
  return pathSegments(specifier).some((segment) => folders.includes(segment))
}

function isBroadPath(specifier: string): boolean {
  return ALL_GLOB_PATH.test(specifier.trim().replace(/\\/g, '/'))
}

function isBroadFileSpecifier(tool: string, specifier: string): boolean {
  if (isBroadPath(specifier)) {
    return true
  }
  if (FILE_WRITE_TOOLS.includes(tool)) {
    return reachesFolder(specifier, PROTECTED_FOLDERS)
  }
  return tool === 'Read' && reachesFolder(specifier, SECRET_FOLDERS)
}

function isBroadDomain(specifier: string): boolean {
  const trimmed = specifier.trim()
  if (!trimmed.startsWith('domain:')) {
    return false
  }
  const domain = trimmed.slice('domain:'.length).trim()
  return domain.includes('*') && domain.replace(/^[*.]+/, '').split('.').length < 2
}

function isBroadSpecifier(tool: string, specifier: string): boolean {
  if (SHELL_TOOLS.includes(tool)) {
    return isBroadShellCommand(specifier)
  }
  if (tool === 'WebFetch') {
    return isBroadDomain(specifier)
  }
  return isBroadFileSpecifier(tool, specifier)
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
  return isBroadSpecifier(parsed.tool, parsed.specifier)
}

export function buildRule(tool: string, pattern: string): string {
  const specifier = pattern.trim()
  return specifier ? `${tool}(${specifier})` : tool
}
