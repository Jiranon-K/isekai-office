const HOOK_EVENTS = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'SessionEnd']
const PERMISSION_MATCHER = 'permission_prompt'
const HOOK_TIMEOUT_SECONDS = 2

type HookEntry = { matcher?: string; hooks: { type: 'command'; command: string; timeout: number }[] }

export type HooksSettings = { hooks: Record<string, HookEntry[]> }

export function hookCommand(scriptPath: string): string {
  return `bun "${scriptPath.replaceAll('\\', '/')}"`
}

function entryFor(command: string, matcher?: string): HookEntry[] {
  const hook = { type: 'command' as const, command, timeout: HOOK_TIMEOUT_SECONDS }
  return [matcher ? { matcher, hooks: [hook] } : { hooks: [hook] }]
}

export function hooksSettings(scriptPath: string): HooksSettings {
  const command = hookCommand(scriptPath)
  const hooks: Record<string, HookEntry[]> = {}
  for (const event of HOOK_EVENTS) {
    hooks[event] = entryFor(command)
  }
  hooks.Notification = entryFor(command, PERMISSION_MATCHER)
  return { hooks }
}
