import type { OfficeAgent } from '@shared/types'
import { describeRow } from './broadcast-logic'
import { skipReasonOf, type BroadcastRow } from './party-logic'

type PartyMemberRowProps = {
  agent: OfficeAgent
  ticked: boolean
  locked: boolean
  row: BroadcastRow | null
  onToggle(): void
}

export function PartyMemberRow({ agent, ticked, locked, row, onToggle }: PartyMemberRowProps): React.JSX.Element {
  const blocked = skipReasonOf(agent)
  const note = row ? describeRow(row) : blocked
  return (
    <li className="flex items-center gap-2 px-2 py-1">
      <label className="flex min-w-0 flex-1 items-center gap-2 text-small">
        <input type="checkbox" checked={ticked} disabled={blocked !== null || locked} onChange={onToggle} className="size-4 shrink-0 accent-primary" />
        <span className="truncate">{agent.title}</span>
      </label>
      {note ? <span className="shrink-0 text-caption text-muted-foreground">{note}</span> : null}
    </li>
  )
}
