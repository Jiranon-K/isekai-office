import type { OfficeAgent } from '@shared/types'
import { fillTemplate, templateValues, type QuestTemplate, type TemplateValues } from '@shared/templates'

export type Inserted = { text: string; cursor: number }

export function worktreeName(worktree: string | null): string {
  if (!worktree) {
    return ''
  }
  const segments = worktree.split(/[\\/]/).filter((segment) => segment !== '')
  return segments[segments.length - 1] ?? ''
}

export function agentTemplateValues(agent: Pick<OfficeAgent, 'repo' | 'worktree'>): TemplateValues {
  return templateValues(worktreeName(agent.worktree), agent.repo ?? '', '')
}

export function insertAtCursor(text: string, start: number, end: number, insertion: string): Inserted {
  const from = Math.min(Math.max(start, 0), text.length)
  const to = Math.min(Math.max(end, from), text.length)
  return { text: `${text.slice(0, from)}${insertion}${text.slice(to)}`, cursor: from + insertion.length }
}

export function insertTemplate(text: string, start: number, end: number, template: QuestTemplate, values: TemplateValues): Inserted {
  return insertAtCursor(text, start, end, fillTemplate(template.prompt, values))
}
