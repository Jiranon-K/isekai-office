import type { CommandAction, CommandRequest } from '@shared/types'

const ACTIONS: CommandAction[] = ['prompt', 'escape', 'allow', 'deny', 'choose']

function validChoice(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null
  }
  return value >= 1 && value <= 9 ? value : null
}

export function toCommand(body: unknown): CommandRequest | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const agentId = Reflect.get(body, 'agentId')
  const action = ACTIONS.find((known) => known === Reflect.get(body, 'action'))
  const text = Reflect.get(body, 'text')
  if (typeof agentId !== 'string' || !action) {
    return null
  }
  const choice = action === 'choose' ? validChoice(Reflect.get(body, 'choice')) : null
  if (action === 'choose' && choice === null) {
    return null
  }
  return { agentId, action, text: typeof text === 'string' ? text : undefined, ...(choice === null ? {} : { choice }) }
}
