import type { ReplayDay } from './replay-logic'
import { ReplayLanes } from './ReplayLanes'
import { ReplayPlayButton, ReplayScrubber, ReplaySpeeds } from './ReplayControls'
import type { Replay } from './use-replay'

export function ReplayBar({ replay, day }: { replay: Replay; day: ReplayDay }): React.JSX.Element {
  return (
    <section
      aria-label="แถบย้อนดู"
      className="absolute right-3 bottom-3 left-3 z-overlay grid grid-cols-[7rem_1fr_auto] items-center gap-x-3 gap-y-2 rounded-lg border bg-card/95 p-3 shadow-md backdrop-blur-md"
    >
      {day.lanes.length > 0 ? <ReplayLanes day={day} at={replay.at} /> : <p className="col-span-3 text-small text-muted-foreground">ไม่มีบันทึกของวันนี้</p>}
      <ReplayPlayButton replay={replay} />
      <ReplayScrubber replay={replay} start={day.start} end={day.end} />
      <ReplaySpeeds replay={replay} />
    </section>
  )
}
