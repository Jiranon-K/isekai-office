import { Badge, type BadgeProps } from '@/components/badge'
import { AgentChip } from './AgentChip'
import { GATE_LABELS, GATES, type Gate, type GateProgress, type GateState, type ReleaseRound, type ReleaseRow } from './release-logic'
import { spaceTone } from './view-logic'

type ReleaseChecklistProps = { rounds: ReleaseRound[]; onSendToAgent(agentId: string): void }

const GATE_VARIANTS: Record<GateState, NonNullable<BadgeProps['variant']>> = {
  pass: 'green',
  wait: 'amber',
  fail: 'red',
  unknown: 'muted'
}

const GATE_MARKS: Record<GateState, string> = { pass: '✓', wait: '…', fail: '✕', unknown: '—' }

function daysLeftLabel(days: number | null): string | null {
  if (days === null) {
    return null
  }
  return days < 0 ? `เลยกำหนด ${-days} วัน` : `เหลือ ${days} วัน`
}

function ProgressBars({ progress }: { progress: GateProgress }): React.JSX.Element {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {GATES.map((name) => {
        const { pass, total } = progress[name]
        return (
          <li key={name} className="flex items-center gap-2 text-caption">
            <span className="w-14 text-muted-foreground">{GATE_LABELS[name]}</span>
            <progress className="h-1.5 w-20 accent-primary" value={pass} max={Math.max(total, 1)} aria-label={`${GATE_LABELS[name]} ${pass} จาก ${total}`} />
            <span className="tabular-nums">{pass}/{total}</span>
          </li>
        )
      })}
    </ul>
  )
}

function GateCell({ gate }: { gate: Gate }): React.JSX.Element {
  const content = (
    <Badge variant={GATE_VARIANTS[gate.state]}>
      {GATE_MARKS[gate.state]}
      {gate.detail ? <span className="ml-1">{gate.detail}</span> : null}
    </Badge>
  )
  if (!gate.url) {
    return content
  }
  return (
    <a href={gate.url} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex rounded-sm">
      {content}
    </a>
  )
}

function RowView({ row, onSendToAgent }: { row: ReleaseRow; onSendToAgent(agentId: string): void }): React.JSX.Element {
  const { card, agent } = row.item
  return (
    <tr className="border-t border-border align-top">
      <th scope="row" className="py-2 pr-3 text-left font-normal">
        <a href={card.url} target="_blank" rel="noopener noreferrer" className="focus-ring rounded-sm text-issue-key">{card.key ?? 'ไม่มี key'}</a>
        <p className="line-clamp-2 text-small">{card.title}</p>
        {agent ? <AgentChip agent={agent} onOpen={onSendToAgent} /> : null}
      </th>
      {GATES.map((name) => (
        <td key={name} className="py-2 pr-3">
          <GateCell gate={row.gates[name]} />
        </td>
      ))}
    </tr>
  )
}

function RoundView({ round, onSendToAgent }: { round: ReleaseRound; onSendToAgent(agentId: string): void }): React.JSX.Element {
  const remaining = daysLeftLabel(round.daysLeft)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-card-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={spaceTone(round.sprint.space)}>{round.sprint.space}</Badge>
        <h3 className="text-body-strong">{round.sprint.name}</h3>
        {remaining ? <span className="text-small text-muted-foreground">{remaining}</span> : null}
      </div>
      <ProgressBars progress={round.progress} />
      {round.rows.length === 0 ? (
        <p className="text-small text-muted-foreground">ไม่มี card ใน sprint นี้</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-small">
            <thead>
              <tr className="text-left text-caption text-muted-foreground">
                <th scope="col" className="pb-1 pr-3 font-medium">card</th>
                {GATES.map((name) => (
                  <th key={name} scope="col" className="pb-1 pr-3 font-medium">{GATE_LABELS[name]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {round.rows.map((row) => (
                <RowView key={row.item.card.id} row={row} onSendToAgent={onSendToAgent} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function ReleaseChecklist({ rounds, onSendToAgent }: ReleaseChecklistProps): React.JSX.Element {
  return (
    <section aria-labelledby="release-rounds" className="flex flex-col gap-3">
      <h2 id="release-rounds" className="text-body-strong">รอบ release</h2>
      <div className="flex flex-col gap-5">
        {rounds.length === 0 ? (
          <p className="text-small text-muted-foreground">ไม่มี sprint ที่ตรงกับตัวกรอง</p>
        ) : (
          rounds.map((round) => <RoundView key={`${round.sprint.space}:${round.sprint.name}`} round={round} onSendToAgent={onSendToAgent} />)
        )}
      </div>
    </section>
  )
}
