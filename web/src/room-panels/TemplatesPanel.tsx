import { TEMPLATE_LIMIT, type QuestTemplate } from '@shared/templates'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TemplateEditor } from './TemplateEditor'
import {
  draftFromTemplate,
  draftProblems,
  draftToTemplate,
  EMPTY_TEMPLATE_DRAFT,
  hasDraftProblem,
  nextTemplateId,
  removeTemplate,
  upsertTemplate,
  type TemplateDraft
} from './template-edit-logic'
import { useTemplates } from './use-templates'

type Editing = { id: string | null; draft: TemplateDraft }

function TemplateRow({ template, disabled, onEdit, onDelete }: { template: QuestTemplate; disabled: boolean; onEdit(): void; onDelete(): void }): React.JSX.Element {
  return (
    <li className="flex items-center gap-2 rounded-md border px-2 py-1.5">
      <span className="min-w-0 flex-1 truncate text-small">{template.name}</span>
      <Button type="button" size="xs" variant="outline" disabled={disabled} onClick={onEdit}>
        แก้ไข
      </Button>
      <Button type="button" size="xs" variant="outline" disabled={disabled} onClick={onDelete}>
        ลบ
      </Button>
    </li>
  )
}

export function TemplatesPanel(): React.JSX.Element {
  const store = useTemplates()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [changed, setChanged] = useState(false)
  const templates = store.templates

  if (store.error) {
    return <p role="alert" className="text-small text-destructive">อ่านแม่แบบไม่ได้ ตรวจไฟล์ templates.json</p>
  }
  if (templates === null) {
    return <p role="status" className="text-small text-muted-foreground">กำลังโหลดแม่แบบ</p>
  }

  async function commit(next: QuestTemplate[]): Promise<boolean> {
    setSaving(true)
    const outcome = await store.save(next)
    setSaving(false)
    setFailed(outcome === 'failed')
    setChanged(outcome === 'stale')
    return outcome === 'saved'
  }

  async function saveDraft(): Promise<void> {
    setTouched(true)
    if (!editing || saving || hasDraftProblem(draftProblems(editing.draft))) {
      return
    }
    const id = editing.id ?? nextTemplateId(templates ?? [])
    const saved = await commit(upsertTemplate(templates ?? [], draftToTemplate(editing.draft, id)))
    if (saved) {
      setEditing(null)
    }
  }

  function startEditing(next: Editing): void {
    setEditing(next)
    setTouched(false)
    setFailed(false)
    setChanged(false)
  }

  function remove(template: QuestTemplate): void {
    if (window.confirm(`ลบแม่แบบ ${template.name}?`)) {
      void commit(removeTemplate(templates ?? [], template.id))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {templates.length === 0 ? <p className="text-small text-muted-foreground">ยังไม่มีแม่แบบ</p> : null}
      <ul className="flex flex-col gap-1" aria-label="แม่แบบ">
        {templates.map((template) => (
          <TemplateRow
            key={template.id}
            template={template}
            disabled={saving}
            onEdit={() => startEditing({ id: template.id, draft: draftFromTemplate(template) })}
            onDelete={() => remove(template)}
          />
        ))}
      </ul>
      {changed ? <p role="alert" className="text-small text-destructive">รายการแม่แบบเปลี่ยนไปจากอีกหน้าต่าง โหลดรายการใหม่แล้ว ลองอีกครั้ง</p> : null}
      {failed && !editing ? <p role="alert" className="text-small text-destructive">บันทึกแม่แบบไม่ได้ ลองใหม่อีกครั้ง</p> : null}
      {editing ? (
        <TemplateEditor
          draft={editing.draft}
          saving={saving}
          failed={failed}
          touched={touched}
          onChange={(draft) => setEditing({ ...editing, draft })}
          onSave={() => void saveDraft()}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <Button
          type="button"
          size="sm"
          disabled={saving || templates.length >= TEMPLATE_LIMIT}
          onClick={() => startEditing({ id: null, draft: EMPTY_TEMPLATE_DRAFT })}
        >
          เพิ่มแม่แบบ
        </Button>
      )}
    </div>
  )
}
