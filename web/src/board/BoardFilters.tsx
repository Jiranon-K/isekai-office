import { cn } from '@/lib/utils'
import { sprintChoiceFromValue, sprintChoiceValue, type BoardFilter, type FilterOptions } from './monitor-logic'

type BoardFiltersProps = { filter: BoardFilter; options: FilterOptions; onChange(filter: BoardFilter): void }

const SELECT_CLASS =
  'focus-ring h-8 rounded-md border border-border bg-popover px-2 text-small text-foreground'

type FieldProps = { label: string; value: string; onChange(value: string): void; children: React.ReactNode }

function Field({ label, value, onChange, children }: FieldProps): React.JSX.Element {
  return (
    <label className="flex items-center gap-2 text-small text-muted-foreground">
      {label}
      <select className={cn(SELECT_CLASS)} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  )
}

export function BoardFilters({ filter, options, onChange }: BoardFiltersProps): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Field label="product" value={filter.space ?? ''} onChange={(value) => onChange({ ...filter, space: value || null })}>
        <option value="">ทุก product</option>
        {options.spaces.map((space) => (
          <option key={space} value={space}>
            {space}
          </option>
        ))}
      </Field>
      <Field label="sprint" value={sprintChoiceValue(filter.sprint)} onChange={(value) => onChange({ ...filter, sprint: sprintChoiceFromValue(value) })}>
        <option value="running">sprint ที่กำลังวิ่ง</option>
        <option value="all">ทุก sprint</option>
        {options.sprints.map((name) => (
          <option key={name} value={sprintChoiceValue({ kind: 'named', name })}>
            {name}
          </option>
        ))}
      </Field>
    </div>
  )
}
