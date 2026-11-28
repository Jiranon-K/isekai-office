import { useEffect, useRef, useState } from 'react'
import type { HandoffDraft } from '@shared/handoff'
import { NAME_RULE, PROMPT_MAX } from '@shared/spawn'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { sendSpawn, useRepos } from '@/lib/api'
import { READ_ONLY_REASON, useSourceCaps } from '@/lib/source-caps'
import {
  applyTemplate,
  buildSpawnRequest,
  EMPTY_FIELDS,
  fieldsFromDraft,
  hasProblem,
  resolveRepoId,
  shouldConfirmReplace,
  spawnProblems,
  withFilledPrompt,
  type SpawnFields
} from './spawn-logic'
import { TemplatePicker } from './TemplatePicker'
import { useTemplates } from './use-templates'

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'failed'; reason: string }

type SpawnFormProps = {
  handoffDraft: HandoffDraft | null
  onClearHandoff(): void
}

const FIELD_CLASS =
  'focus-ring h-9 w-full rounded-lg border border-input bg-popover px-3 text-body text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive'

type FieldProps = { label: string; hint?: string; children: React.ReactNode }

function Field({ label, hint, children }: FieldProps): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-small">
      <span className="text-body-strong">{label}</span>
      {children}
      {hint ? <span className="text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

function HandoffBanner({ draft, onClear }: { draft: HandoffDraft; onClear(): void }): React.JSX.Element {
  return (
    <div role="status" className="flex flex-col gap-1 rounded-md border bg-muted/60 px-2.5 py-2 text-small">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-body-strong">รับช่วงต่อจาก {draft.sourceTitle}</span>
        <Button type="button" variant="ghost" size="xs" onClick={onClear}>
          ล้างค่า
        </Button>
      </div>
      {draft.fallbackUsed ? <span className="text-caption text-muted-foreground">ดึงประวัติแชทไม่ได้ ใช้สรุปล่าสุดแทน</span> : null}
    </div>
  )
}

function statusLine(status: Status): React.JSX.Element | null {
  if (status.kind === 'sent') {
    return <p role="status" className="text-small">เรียกแล้ว รอสักครู่จะเดินเข้ามา</p>
  }
  if (status.kind === 'failed') {
    return <p role="alert" className="text-small text-destructive break-words">{status.reason}</p>
  }
  return null
}

function SpawnFields({ handoffDraft, onClearHandoff }: SpawnFormProps): React.JSX.Element {
  const repos = useRepos()
  const templates = useTemplates()
  const appliedDraftRef = useRef<HandoffDraft | null>(handoffDraft)
  const [templateId, setTemplateId] = useState('')
  const [lastFilled, setLastFilled] = useState('')
  const [fields, setFields] = useState<SpawnFields>(() => fieldsFromDraft(handoffDraft))
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (handoffDraft === null || handoffDraft === appliedDraftRef.current) {
      return
    }
    appliedDraftRef.current = handoffDraft
    setFields(fieldsFromDraft(handoffDraft))
    setTemplateId('')
    setLastFilled('')
    setTouched(false)
    setStatus({ kind: 'idle' })
  }, [handoffDraft])

  const list = repos.data ?? []
  const repoId = resolveRepoId(list, fields.repoId, handoffDraft)
  const current = { ...fields, repoId }
  const template = templates.templates?.find((item) => item.id === templateId) ?? null
  const repoName = list.find((repo) => repo.id === repoId)?.name ?? ''
  const filled = withFilledPrompt(current, template, repoName)
  const problems = spawnProblems(filled, template)
  const sending = status.kind === 'sending'
  const change = (patch: Partial<SpawnFields>): void => {
    setFields({ ...current, ...patch })
    setStatus({ kind: 'idle' })
  }

  function clearDraft(): void {
    appliedDraftRef.current = null
    onClearHandoff()
    setFields(EMPTY_FIELDS)
    setTemplateId('')
    setLastFilled('')
    setTouched(false)
    setStatus({ kind: 'idle' })
  }

  function pickTemplate(id: string): void {
    const template = templates.templates?.find((item) => item.id === id)
    if (!template) {
      setTemplateId('')
      return
    }
    if (shouldConfirmReplace(current.prompt, lastFilled) && !window.confirm('แทนที่ prompt ที่พิมพ์ไว้?')) {
      return
    }
    const applied = applyTemplate(current, template)
    setTemplateId(id)
    setLastFilled(applied.prompt)
    change(applied)
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setTouched(true)
    if (sending || hasProblem(problems)) {
      return
    }
    setStatus({ kind: 'sending' })
    const result = await sendSpawn(buildSpawnRequest(filled))
    if (!result.ok) {
      setStatus({ kind: 'failed', reason: result.error ?? 'spawn_failed' })
      return
    }
    appliedDraftRef.current = null
    onClearHandoff()
    setFields(EMPTY_FIELDS)
    setTemplateId('')
    setLastFilled('')
    setTouched(false)
    setStatus({ kind: 'sent' })
  }

  if (repos.error) {
    return <p role="alert" className="text-small text-destructive">อ่านรายชื่อ repo จาก Orca ไม่ได้</p>
  }
  return (
    <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
      {handoffDraft ? <HandoffBanner draft={handoffDraft} onClear={clearDraft} /> : null}
      <Field label="Repo">
        <select
          className={FIELD_CLASS}
          value={repoId}
          disabled={sending || list.length === 0}
          onChange={(event) => change({ repoId: event.target.value })}
        >
          {list.map((repo) => (
            <option key={repo.id} value={repo.id}>
              {repo.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="ชื่อ worktree" hint={NAME_RULE}>
        <input
          className={FIELD_CLASS}
          value={fields.name}
          disabled={sending}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={touched && problems.name}
          onChange={(event) => change({ name: event.target.value })}
        />
      </Field>
      <Field label="Base branch (ไม่ใส่ก็ได้)">
        <input
          className={FIELD_CLASS}
          value={fields.baseBranch}
          disabled={sending}
          autoComplete="off"
          spellCheck={false}
          placeholder="origin/main"
          aria-invalid={touched && problems.baseBranch}
          onChange={(event) => change({ baseBranch: event.target.value })}
        />
      </Field>
      <Field label="แม่แบบ" hint={templates.error ? 'อ่านแม่แบบไม่ได้' : undefined}>
        <TemplatePicker
          templates={templates.templates ?? []}
          selectedId={templateId}
          disabled={sending}
          className={FIELD_CLASS}
          onPick={pickTemplate}
        />
      </Field>
      <Field label="prompt แรก (ไม่ใส่ก็ได้)" hint={`ไม่เกิน ${PROMPT_MAX} ตัวอักษร`}>
        <Textarea
          value={fields.prompt}
          disabled={sending}
          aria-invalid={touched && problems.prompt}
          onChange={(event) => change({ prompt: event.target.value })}
        />
      </Field>
      <Button type="submit" disabled={sending || list.length === 0}>
        {sending ? <Spinner /> : null}
        เรียกเข้ามา
      </Button>
      {statusLine(status)}
    </form>
  )
}

export function SpawnForm({ handoffDraft, onClearHandoff }: SpawnFormProps): React.JSX.Element {
  const caps = useSourceCaps()
  if (!caps.spawn) {
    return <p role="note" className="rounded-md bg-muted p-2 text-small text-muted-foreground">{READ_ONLY_REASON}</p>
  }
  return <SpawnFields handoffDraft={handoffDraft} onClearHandoff={onClearHandoff} />
}
