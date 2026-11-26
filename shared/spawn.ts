export const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/
export const BASE_BRANCH_PATTERN = /^[A-Za-z0-9._/-]{1,100}$/
export const PROMPT_MAX = 4000

export const NAME_RULE = 'a-z 0-9 และ - เท่านั้น ขึ้นต้นด้วยตัวอักษรหรือตัวเลข ไม่เกิน 48 ตัว'

export function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name)
}

export function isValidBaseBranch(ref: string): boolean {
  return BASE_BRANCH_PATTERN.test(ref) && !ref.startsWith('-')
}

export function cleanPrompt(prompt: string): string | null {
  const text = prompt.trim()
  return text ? text : null
}

export function isValidPrompt(prompt: string): boolean {
  return prompt.length <= PROMPT_MAX
}
