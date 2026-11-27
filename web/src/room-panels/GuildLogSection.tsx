import type { LogEvent } from '@shared/types'
import { Badge } from '@/components/badge'
import type { Loadable } from '@/lib/api'
import { PanelNote } from './SessionList'
import { logNote, useLogLocation } from './log-note'
import { eventText, splitAtLastSeen, waitedMs, waitText } from './log-logic'

type GuildLogSectionProps = {
  log: Loadable<{ events: LogEvent[] }>
  lastHidden: number | null
  present: ReadonlySet<string>
  onSelect(agentId: string): void
}

function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}

function RowBody({ events, index }: { events: LogEvent[]; index: number }): React.JSX.Element | null {
  const event = events[index]
  if (!event) {
    return null
  }
  const waited = waitedMs(events, index)
  return (
    <>
      <span className="w-11 shrink-0 font-mono text-caption text-muted-foreground">{formatClock(event.at)}</span>
      <span className="min-w-0 flex-1 truncate text-small">{event.title}</span>
      <span className="shrink-0 text-caption text-muted-foreground">{eventText(event)}</span>
      {waited === null ? null : <Badge variant="amber">{waitText(waited)}</Badge>}
    </>
  )
}

function LogRow({ events, index, present, onSelect }: { events: LogEvent[]; index: number; present: ReadonlySet<string>; onSelect(agentId: string): void }): React.JSX.Element | null {
  const event = events[index]
  if (!event) {
    return null
  }
  if (!present.has(event.agentId)) {
    return (
      <li className="flex items-center gap-2 px-2 py-1.5">
        <RowBody events={events} index={index} />
      </li>
    )
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(event.agentId)}
        className="focus-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-fast hover:bg-accent hover:text-accent-foreground motion-reduce:transition-none"
      >
        <RowBody events={events} index={index} />
      </button>
    </li>
  )
}

export function GuildLogSection({ log, lastHidden, present, onSelect }: GuildLogSectionProps): React.JSX.Element {
  const events = log.data?.events ?? []
  const location = useLogLocation()
  const { newer } = splitAtLastSeen(events, lastHidden)
  return (
    <section aria-label="บันทึกของกิลด์" className="flex flex-col gap-2 border-t border-border pt-3">
      <h3 className="text-small font-medium">บันทึกของกิลด์</h3>
      {log.error ? <PanelNote>โหลดบันทึกไม่ได้</PanelNote> : null}
      {!log.error && events.length === 0 ? <PanelNote>{log.loading ? 'กำลังโหลด' : 'ยังไม่มีอะไรเปลี่ยน'}</PanelNote> : null}
      {events.length > 0 ? (
        <ul className="flex max-h-64 flex-col overflow-y-auto">
          {events.map((event, index) => (
            <LogItem key={`${event.at}-${event.agentId}-${index}`} events={events} index={index} divided={index === 0 && newer.length > 0} present={present} onSelect={onSelect} />
          ))}
        </ul>
      ) : null}
      <p className="text-caption text-muted-foreground">{logNote(location)}</p>
    </section>
  )
}

function LogItem({ events, index, divided, present, onSelect }: { events: LogEvent[]; index: number; divided: boolean; present: ReadonlySet<string>; onSelect(agentId: string): void }): React.JSX.Element {
  return (
    <>
      {divided ? <li className="mb-1 border-b border-dashed border-border pb-1 text-center text-caption text-muted-foreground">ตั้งแต่คุณไม่อยู่</li> : null}
      <LogRow events={events} index={index} present={present} onSelect={onSelect} />
    </>
  )
}
