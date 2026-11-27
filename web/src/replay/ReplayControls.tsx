import { Button } from '@/components/ui/button'
import { REPLAY_SPEEDS } from './playback-logic'
import { formatClockSeconds } from './replay-format'
import type { Replay } from './use-replay'

export function ReplayPlayButton({ replay }: { replay: Replay }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={replay.togglePlay} aria-pressed={replay.playing}>
        {replay.playing ? 'หยุด' : 'เล่น'}
      </Button>
      <span className="font-mono text-small tabular-nums">{formatClockSeconds(replay.at)}</span>
    </div>
  )
}

export function ReplayScrubber({ replay, start, end }: { replay: Replay; start: number; end: number }): React.JSX.Element {
  return (
    <input
      type="range"
      aria-label="เลื่อนเวลาย้อนดู"
      className="focus-ring w-full accent-primary"
      min={start}
      max={end}
      step={1}
      value={replay.at}
      onChange={(event) => replay.seek(Number(event.target.value))}
    />
  )
}

export function ReplaySpeeds({ replay }: { replay: Replay }): React.JSX.Element {
  return (
    <div role="group" aria-label="ความเร็ว" className="flex items-center gap-1">
      {REPLAY_SPEEDS.map((speed) => (
        <Button
          key={speed}
          type="button"
          size="xs"
          variant={replay.speed === speed ? 'default' : 'outline'}
          aria-pressed={replay.speed === speed}
          onClick={() => replay.setSpeed(speed)}
        >
          {speed}×
        </Button>
      ))}
    </div>
  )
}
