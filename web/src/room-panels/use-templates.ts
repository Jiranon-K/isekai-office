import type { QuestTemplate } from '@shared/templates'
import { useCallback, useEffect, useState } from 'react'
import { fetchTemplates, saveTemplates } from '@/lib/templates-api'

export type TemplatesState = {
  templates: QuestTemplate[] | null
  error: string | null
  save(next: QuestTemplate[]): Promise<boolean>
}

export function useTemplates(): TemplatesState {
  const [templates, setTemplates] = useState<QuestTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    fetchTemplates()
      .then((list) => current && setTemplates(list))
      .catch(() => current && setError('templates_unavailable'))
    return () => {
      current = false
    }
  }, [])

  const save = useCallback(async (next: QuestTemplate[]): Promise<boolean> => {
    const result = await saveTemplates(next)
    if (result.ok) {
      setTemplates(next)
      setError(null)
    }
    return result.ok
  }, [])

  return { templates, error, save }
}
