import { useState } from 'react'
import { NAME_RULE, PROMPT_MAX } from '@shared/spawn'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { sendSpawn, useRepos } from '@/lib/api'
import { READ_ONLY_REASON, useSourceCaps } from '@/lib/source-caps'
import {
  applyTemplate,
  buildSpawnRequest,
  describeReposError,
  describeSpawnError,
  EMPTY_FIELDS,
  EMPTY_REPOS_NOTE,
  hasEmptyRepos,
  hasProblem,
  shouldConfirmReplace,
  spawnProblems,
  withFilledPrompt,
  type SpawnFields
} from './spawn-logic'
import { TemplatePicker } from './TemplatePicker'
import { useTemplates } from './use-templates'

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'failed'; reason: string }

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

function statusLine(status: Status): React.JSX.Element | null {
  if (status.kind === 'sent') {
    return <p role="status" className="text-small">เรียกแล้ว รอสักครู่จะเดินเข้ามา</p>
  }
  if (status.kind === 'failed') {
    return <p role="alert" className="text-small text-destructive break-words">{status.reason}</p>
  }
  return null
}

function SpawnFields(): React.JSX.Element {
  const repos = useRepos()
  const templates = useTemplates()
  const [templateId, setTemplateId] = useState('')
  const [lastFilled, setLastFilled] = useState('')
  const [fields, setFields] = useState<SpawnFields>(EMPTY_FIELDS)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [touched, setTouched] = useState(false)
  const list = repos.data ?? []
  const repoId = fields.repoId || (list[0]?.id ?? '')
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
      setStatus({ kind: 'failed', reason: describeSpawnError(result.error) })
      return
    }
    setFields(EMPTY_FIELDS)
    setTemplateId('')
    setLastFilled('')
    setTouched(false)
    setStatus({ kind: 'sent' })
  }

  if (repos.error) {
    return <p role="alert" className="text-small text-destructive">{describeReposError(repos.error)}</p>
  }
  if (hasEmptyRepos(repos.data, repos.loading, repos.error)) {
    return <p role="note" className="rounded-md bg-muted p-2 text-small text-muted-foreground">{EMPTY_REPOS_NOTE}</p>
  }
  return (
    <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
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

export function SpawnForm(): React.JSX.Element {
  const caps = useSourceCaps()
  if (!caps.spawn) {
    return <p role="note" className="rounded-md bg-muted p-2 text-small text-muted-foreground">{READ_ONLY_REASON}</p>
  }
  return <SpawnFields />
}
