import type { QuestTemplate, TemplateSnapshot } from '@shared/templates'

export type TemplateSaveResult = { ok: boolean; error: string | null; snapshot: TemplateSnapshot | null }

export async function fetchTemplates(): Promise<TemplateSnapshot> {
  const response = await fetch('/api/templates')
  if (!response.ok) {
    throw new Error('templates_unavailable')
  }
  const body: TemplateSnapshot = await response.json()
  return { templates: body.templates, revision: body.revision }
}

function failedSave(status: number): TemplateSaveResult {
  return { ok: false, error: status === 409 ? 'stale' : 'save_failed', snapshot: null }
}

export async function saveTemplates(templates: QuestTemplate[], revision: string): Promise<TemplateSaveResult> {
  try {
    const response = await fetch('/api/templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templates, revision })
    })
    if (!response.ok) {
      return failedSave(response.status)
    }
    const body: TemplateSnapshot = await response.json()
    return { ok: true, error: null, snapshot: { templates: body.templates, revision: body.revision } }
  } catch {
    return { ok: false, error: 'server_unreachable', snapshot: null }
  }
}
