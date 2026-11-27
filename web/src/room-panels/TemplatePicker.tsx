import type { QuestTemplate } from '@shared/templates'

type TemplatePickerProps = {
  templates: QuestTemplate[]
  selectedId: string
  disabled: boolean
  className: string
  onPick(id: string): void
}

export function TemplatePicker({ templates, selectedId, disabled, className, onPick }: TemplatePickerProps): React.JSX.Element {
  return (
    <select
      className={className}
      value={selectedId}
      disabled={disabled}
      aria-label="แม่แบบ"
      onChange={(event) => onPick(event.target.value)}
    >
      <option value="">ไม่ใช้</option>
      {templates.map((template) => (
        <option key={template.id} value={template.id}>
          {template.name}
        </option>
      ))}
    </select>
  )
}
