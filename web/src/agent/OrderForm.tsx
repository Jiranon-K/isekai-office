import { LIST_LABELS } from '@shared/orders'
import { ORDER_PRESETS, PICKABLE_TOOLS } from '@shared/rules'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { checkDraft, describeOrderError, draftFromRule, EMPTY_DRAFT, type OrderDraft } from './orders-logic'

type OrderFormProps = { disabled: boolean; onAdd(draft: OrderDraft & { rule: string }): Promise<string | null> }

const FIELD_CLASS =
  'focus-ring h-8 rounded-md border border-input bg-popover px-2 text-small text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50'

const LISTS: Array<OrderDraft['list']> = ['allow', 'deny']

function ListSwitch({ value, disabled, onChange }: { value: OrderDraft['list']; disabled: boolean; onChange(list: OrderDraft['list']): void }): React.JSX.Element {
  return (
    <div role="group" aria-label="ชนิดของกฎ" className="flex gap-1">
      {LISTS.map((list) => (
        <Button key={list} type="button" size="sm" disabled={disabled} variant={value === list ? 'default' : 'outline'} aria-pressed={value === list} onClick={() => onChange(list)}>
          {LIST_LABELS[list]}
        </Button>
      ))}
    </div>
  )
}

function Presets({ disabled, onPick }: { disabled: boolean; onPick(rule: string): void }): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-1" aria-label="กฎที่ใช้บ่อย">
      {ORDER_PRESETS.map((preset) => (
        <Button key={preset.rule} type="button" size="xs" variant="outline" disabled={disabled} className="font-mono" onClick={() => onPick(preset.rule)}>
          {preset.label}
        </Button>
      ))}
    </div>
  )
}

export function OrderForm({ disabled, onAdd }: OrderFormProps): React.JSX.Element {
  const [draft, setDraft] = useState<OrderDraft>(EMPTY_DRAFT)
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const check = checkDraft(draft)
  const typed = draft.pattern.trim() !== ''
  const blocked = disabled || sending

  function change(patch: Partial<OrderDraft>): void {
    setDraft({ ...draft, ...patch })
    setFailure(null)
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (blocked || check.rule === null) {
      return
    }
    setSending(true)
    const error = await onAdd({ ...draft, rule: check.rule })
    setSending(false)
    setFailure(error)
    if (error === null) {
      setDraft({ ...EMPTY_DRAFT, list: draft.list })
    }
  }

  const problem = typed || draft.tool !== 'Bash' ? check.problem : null
  return (
    <form className="flex flex-col gap-2" onSubmit={submit} noValidate>
      <ListSwitch value={draft.list} disabled={blocked} onChange={(list) => change({ list })} />
      <div className="flex gap-1">
        <select aria-label="เครื่องมือ" className={FIELD_CLASS} value={draft.tool} disabled={blocked} onChange={(event) => change({ tool: event.target.value })}>
          {PICKABLE_TOOLS.map((tool) => (
            <option key={tool} value={tool}>
              {tool}
            </option>
          ))}
        </select>
        <input
          aria-label="รูปแบบคำสั่ง"
          className={`${FIELD_CLASS} min-w-0 flex-1 font-mono`}
          placeholder="เช่น bun run check หรือ git diff *"
          value={draft.pattern}
          disabled={blocked}
          maxLength={200}
          onChange={(event) => change({ pattern: event.target.value })}
        />
        <Button type="submit" size="sm" disabled={blocked || check.rule === null}>
          เพิ่ม
        </Button>
      </div>
      <Presets disabled={blocked} onPick={(rule) => change(draftFromRule(rule))} />
      {problem ? <p role="alert" className="text-small text-destructive">{problem}</p> : null}
      {failure ? <p role="alert" className="text-small text-destructive">{describeOrderError(failure)}</p> : null}
    </form>
  )
}
