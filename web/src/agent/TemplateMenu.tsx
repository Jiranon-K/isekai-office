import type { QuestTemplate } from '@shared/templates'
import { useEffect, useState } from 'react'
import { fetchTemplates } from '@/lib/templates-api'

type TemplateMenuProps = { disabled: boolean; onPick(template: QuestTemplate): void }

export function useMenuTemplates(): QuestTemplate[] {
  const [templates, setTemplates] = useState<QuestTemplate[]>([])
  useEffect(() => {
    let current = true
    fetchTemplates()
      .then((list) => current && setTemplates(list))
      .catch(() => current && setTemplates([]))
    return () => {
      current = false
    }
  }, [])
  return templates
}

export function TemplateMenu({ disabled, onPick }: TemplateMenuProps): React.JSX.Element | null {
  const templates = useMenuTemplates()
  if (templates.length === 0) {
    return null
  }
  return (
    <select
      aria-label="แม่แบบ"
      value=""
      disabled={disabled}
      className="focus-ring h-8 rounded-md border border-input bg-popover px-2 text-small text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      onChange={(event) => {
        const template = templates.find((item) => item.id === event.target.value)
        if (template) {
          onPick(template)
        }
      }}
    >
      <option value="">แม่แบบ</option>
      {templates.map((template) => (
        <option key={template.id} value={template.id}>
          {template.name}
        </option>
      ))}
    </select>
  )
}
