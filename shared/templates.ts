import { isValidBaseBranch, PROMPT_MAX } from './spawn'

export type QuestTemplate = {
  id: string
  name: string
  prompt: string
  baseBranch: string | null
  namePrefix: string | null
}

export type TemplateList = { templates: QuestTemplate[] }

export type TemplateSnapshot = TemplateList & { revision: string }

export type TemplateValues = { name: string; repo: string; branch: string }

export const TEMPLATE_LIMIT = 30
export const TEMPLATE_ID_PATTERN = /^[a-z0-9-]{1,40}$/
export const TEMPLATE_PREFIX_PATTERN = /^[a-z0-9][a-z0-9-]{0,19}$/
export const TEMPLATE_NAME_MAX = 40
export const DEFAULT_BRANCH = 'main'
export const NO_FILE_REVISION = 'none'

export const BUILT_IN_TEMPLATES: QuestTemplate[] = [
  {
    id: 'fix-bug',
    name: 'แก้บั๊ก',
    prompt:
      "Reproduce the bug with a failing test first. Find the root cause, fix it, and run the project's check command. Do not change unrelated code.",
    baseBranch: null,
    namePrefix: 'fix-'
  },
  {
    id: 'review-branch',
    name: 'รีวิว branch',
    prompt: 'Review the diff of this branch against {{branch}}. List problems by severity with file and line. Do not edit any file.',
    baseBranch: null,
    namePrefix: 'review-'
  },
  {
    id: 'write-tests',
    name: 'เขียนเทสต์',
    prompt:
      'Find the code in {{repo}} with the least test coverage that matters most. Write tests for it next to the files they test. Do not change behaviour.',
    baseBranch: null,
    namePrefix: 'test-'
  }
]

export function fillTemplate(prompt: string, values: TemplateValues): string {
  return prompt.replace(/\{\{(name|repo|branch)\}\}/g, (_match, key: keyof TemplateValues) => values[key])
}

export function templateValues(name: string, repo: string, baseBranch: string): TemplateValues {
  return { name, repo, branch: baseBranch.trim() || DEFAULT_BRANCH }
}

function nullableText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return null
  }
  return typeof value === 'string' ? value : undefined
}

function toTemplate(item: unknown): QuestTemplate | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }
  const id = Reflect.get(item, 'id')
  const name = Reflect.get(item, 'name')
  const prompt = Reflect.get(item, 'prompt')
  const baseBranch = nullableText(Reflect.get(item, 'baseBranch'))
  const namePrefix = nullableText(Reflect.get(item, 'namePrefix'))
  if (typeof id !== 'string' || !TEMPLATE_ID_PATTERN.test(id)) {
    return null
  }
  if (typeof name !== 'string' || name.length < 1 || name.length > TEMPLATE_NAME_MAX) {
    return null
  }
  if (typeof prompt !== 'string' || prompt.length < 1 || prompt.length > PROMPT_MAX) {
    return null
  }
  if (baseBranch === undefined || (baseBranch !== null && !isValidBaseBranch(baseBranch))) {
    return null
  }
  if (namePrefix === undefined || (namePrefix !== null && !TEMPLATE_PREFIX_PATTERN.test(namePrefix))) {
    return null
  }
  return { id, name, prompt, baseBranch, namePrefix }
}

export function toTemplates(body: unknown): QuestTemplate[] | null {
  const list = typeof body === 'object' && body !== null ? Reflect.get(body, 'templates') : undefined
  if (!Array.isArray(list) || list.length > TEMPLATE_LIMIT) {
    return null
  }
  const templates: QuestTemplate[] = []
  for (const item of list) {
    const template = toTemplate(item)
    if (template === null || templates.some((other) => other.id === template.id)) {
      return null
    }
    templates.push(template)
  }
  return templates
}
