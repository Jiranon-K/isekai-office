import { PROMPT_MAX } from '@shared/spawn'
import { TEMPLATE_NAME_MAX } from '@shared/templates'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { draftProblems, hasDraftProblem, type TemplateDraft } from './template-edit-logic'

type TemplateEditorProps = {
  draft: TemplateDraft
  saving: boolean
  failed: boolean
  touched: boolean
  onChange(draft: TemplateDraft): void
  onSave(): void
  onCancel(): void
}

const FIELD_CLASS =
  'focus-ring h-8 w-full rounded-md border border-input bg-popover px-2 text-small text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive'

type LineProps = { label: string; hint?: string; children: React.ReactNode }

function Line({ label, hint, children }: LineProps): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-small">
      <span className="text-body-strong">{label}</span>
      {children}
      {hint ? <span className="text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

export function TemplateEditor({ draft, saving, failed, touched, onChange, onSave, onCancel }: TemplateEditorProps): React.JSX.Element {
  const problems = draftProblems(draft)
  const invalid = (flag: boolean): boolean => touched && flag
  return (
    <form
      className="flex flex-col gap-2 rounded-md border p-2"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSave()
      }}
    >
      <Line label="ชื่อแม่แบบ" hint={`ไม่เกิน ${TEMPLATE_NAME_MAX} ตัวอักษร`}>
        <input
          className={FIELD_CLASS}
          value={draft.name}
          disabled={saving}
          aria-invalid={invalid(problems.name)}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </Line>
      <Line label="prompt" hint={`ใช้ {{name}} {{repo}} {{branch}} ได้ ไม่เกิน ${PROMPT_MAX} ตัวอักษร`}>
        <Textarea
          value={draft.prompt}
          disabled={saving}
          aria-invalid={invalid(problems.prompt)}
          onChange={(event) => onChange({ ...draft, prompt: event.target.value })}
        />
      </Line>
      <Line label="Base branch (ไม่ใส่ก็ได้)">
        <input
          className={FIELD_CLASS}
          value={draft.baseBranch}
          disabled={saving}
          spellCheck={false}
          aria-invalid={invalid(problems.baseBranch)}
          onChange={(event) => onChange({ ...draft, baseBranch: event.target.value })}
        />
      </Line>
      <Line label="คำนำหน้าชื่อ worktree (ไม่ใส่ก็ได้)" hint="a-z 0-9 และ - ไม่เกิน 20 ตัว เช่น fix-">
        <input
          className={FIELD_CLASS}
          value={draft.namePrefix}
          disabled={saving}
          spellCheck={false}
          aria-invalid={invalid(problems.namePrefix)}
          onChange={(event) => onChange({ ...draft, namePrefix: event.target.value })}
        />
      </Line>
      {failed ? <p role="alert" className="text-small text-destructive">บันทึกแม่แบบไม่ได้ ลองใหม่อีกครั้ง</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving || (touched && hasDraftProblem(problems))}>
          บันทึก
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={saving} onClick={onCancel}>
          ยกเลิก
        </Button>
      </div>
    </form>
  )
}
