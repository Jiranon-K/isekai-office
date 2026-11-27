import { memo } from 'react'
import type { Lane, ReplayDay } from './replay-logic'
import { limitLanes } from './replay-logic'
import { gaps, percentOf, spanStyle } from './replay-geometry'

const HATCH = 'bg-[repeating-linear-gradient(135deg,transparent_0_4px,var(--color-border)_4px_6px)]'
const GAP_LABEL = 'ไม่มีแท็บเปิดอยู่'
const MIN_LABEL_PERCENT = 8

const LaneRow = memo(function LaneRow({ day, lane }: { day: ReplayDay; lane: Lane }): React.JSX.Element {
  return (
    <>
      <span className="truncate text-caption text-muted-foreground" title={lane.title}>
        {lane.title}
      </span>
      <div className="relative h-3 rounded-sm bg-muted/40">
        {lane.present.map((span) => (
          <div key={`p${span.from}`} className="absolute inset-y-0 rounded-sm bg-muted-foreground/35" style={spanStyle(day, span)} />
        ))}
        {lane.waits.map((span) => (
          <div key={`w${span.from}`} data-wait="" className="absolute inset-y-0 rounded-sm bg-tint-amber-fg" style={spanStyle(day, span)} />
        ))}
      </div>
    </>
  )
})

const GapOverlay = memo(function GapOverlay({ day }: { day: ReplayDay }): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 left-[calc(7rem+0.75rem)]" aria-hidden="true">
      {gaps(day).map((span) => (
        <div
          key={span.from}
          data-gap=""
          className={`absolute inset-y-0 flex items-center justify-center overflow-hidden text-caption whitespace-nowrap text-muted-foreground ${HATCH}`}
          style={spanStyle(day, span)}
        >
          {percentOf(day, span.to) - percentOf(day, span.from) >= MIN_LABEL_PERCENT ? (
            <span className="rounded-sm bg-card/80 px-1">{GAP_LABEL}</span>
          ) : null}
        </div>
      ))}
    </div>
  )
})

const LaneRows = memo(function LaneRows({ day }: { day: ReplayDay }): React.JSX.Element {
  const { shown, hidden } = limitLanes(day.lanes)
  return (
    <>
      {shown.map((lane) => (
        <LaneRow key={lane.agentId} day={day} lane={lane} />
      ))}
      {hidden > 0 ? <span className="col-span-2 text-caption text-muted-foreground">+{hidden}</span> : null}
    </>
  )
})

function Playhead({ day, at }: { day: ReplayDay; at: number }): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 left-[calc(7rem+0.75rem)]" aria-hidden="true">
      <div className="absolute inset-y-0 w-px bg-foreground" style={{ left: `${percentOf(day, at)}%` }} />
    </div>
  )
}

export function ReplayLanes({ day, at }: { day: ReplayDay; at: number }): React.JSX.Element {
  return (
    <div className="relative col-span-2 row-start-1 grid grid-cols-[7rem_1fr] items-center gap-x-3 gap-y-1">
      <LaneRows day={day} />
      <GapOverlay day={day} />
      <Playhead day={day} at={at} />
    </div>
  )
}
