import type { QuestTemplate, TemplateSnapshot } from '@shared/templates'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchTemplates, saveTemplates } from '@/lib/templates-api'

export type SaveOutcome = 'saved' | 'stale' | 'failed'

export type TemplatesState = {
  templates: QuestTemplate[] | null
  error: string | null
  save(next: QuestTemplate[]): Promise<SaveOutcome>
}

export function useTemplates(): TemplatesState {
  const [snapshot, setSnapshot] = useState<TemplateSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const revision = useRef<string | null>(null)

  const adopt = useCallback((next: TemplateSnapshot): void => {
    revision.current = next.revision
    setSnapshot(next)
    setError(null)
  }, [])

  useEffect(() => {
    let current = true
    fetchTemplates()
      .then((loaded) => current && adopt(loaded))
      .catch(() => current && setError('templates_unavailable'))
    return () => {
      current = false
    }
  }, [adopt])

  const save = useCallback(
    async (next: QuestTemplate[]): Promise<SaveOutcome> => {
      const result = await saveTemplates(next, revision.current ?? '')
      if (result.snapshot) {
        adopt(result.snapshot)
        return 'saved'
      }
      if (result.error === 'stale') {
        await fetchTemplates().then(adopt, () => setError('templates_unavailable'))
        return 'stale'
      }
      return 'failed'
    },
    [adopt]
  )

  return { templates: snapshot?.templates ?? null, error, save }
}
