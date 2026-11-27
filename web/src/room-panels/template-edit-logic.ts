import { isValidBaseBranch, PROMPT_MAX } from '@shared/spawn'
import { TEMPLATE_NAME_MAX, TEMPLATE_PREFIX_PATTERN, type QuestTemplate } from '@shared/templates'

export type TemplateDraft = { name: string; prompt: string; baseBranch: string; namePrefix: string }

export type DraftProblems = { name: boolean; prompt: boolean; baseBranch: boolean; namePrefix: boolean }

export const EMPTY_TEMPLATE_DRAFT: TemplateDraft = { name: '', prompt: '', baseBranch: '', namePrefix: '' }

export function draftFromTemplate(template: QuestTemplate): TemplateDraft {
  return {
    name: template.name,
    prompt: template.prompt,
    baseBranch: template.baseBranch ?? '',
    namePrefix: template.namePrefix ?? ''
  }
}

export function draftProblems(draft: TemplateDraft): DraftProblems {
  const name = draft.name.trim()
  const prompt = draft.prompt.trim()
  const baseBranch = draft.baseBranch.trim()
  const namePrefix = draft.namePrefix.trim()
  return {
    name: name.length < 1 || name.length > TEMPLATE_NAME_MAX,
    prompt: prompt.length < 1 || prompt.length > PROMPT_MAX,
    baseBranch: baseBranch !== '' && !isValidBaseBranch(baseBranch),
    namePrefix: namePrefix !== '' && !TEMPLATE_PREFIX_PATTERN.test(namePrefix)
  }
}

export function hasDraftProblem(problems: DraftProblems): boolean {
  return Object.values(problems).some(Boolean)
}

export function nextTemplateId(templates: QuestTemplate[]): string {
  let number = templates.length + 1
  while (templates.some((template) => template.id === `quest-${number}`)) {
    number += 1
  }
  return `quest-${number}`
}

export function draftToTemplate(draft: TemplateDraft, id: string): QuestTemplate {
  return {
    id,
    name: draft.name.trim(),
    prompt: draft.prompt.trim(),
    baseBranch: draft.baseBranch.trim() || null,
    namePrefix: draft.namePrefix.trim() || null
  }
}

export function upsertTemplate(templates: QuestTemplate[], template: QuestTemplate): QuestTemplate[] {
  if (!templates.some((item) => item.id === template.id)) {
    return [...templates, template]
  }
  return templates.map((item) => (item.id === template.id ? template : item))
}

export function removeTemplate(templates: QuestTemplate[], id: string): QuestTemplate[] {
  return templates.filter((item) => item.id !== id)
}
