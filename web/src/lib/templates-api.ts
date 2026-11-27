import type { QuestTemplate, TemplateList } from '@shared/templates'

export type TemplateSaveResult = { ok: boolean; error: string | null }

export async function fetchTemplates(): Promise<QuestTemplate[]> {
  const response = await fetch('/api/templates')
  if (!response.ok) {
    throw new Error('templates_unavailable')
  }
  const body: TemplateList = await response.json()
  return body.templates
}

export async function saveTemplates(templates: QuestTemplate[]): Promise<TemplateSaveResult> {
  try {
    const response = await fetch('/api/templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates })
    })
    return response.ok ? { ok: true, error: null } : { ok: false, error: 'save_failed' }
  } catch {
    return { ok: false, error: 'server_unreachable' }
  }
}
