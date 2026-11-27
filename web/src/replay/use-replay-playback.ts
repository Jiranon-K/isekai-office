import { useEffect, useRef } from 'react'
import { stepPlayback, type ReplaySpeed } from './playback-logic'
import type { ReplayDay } from './replay-logic'

const TICK_MS = 100
const MAX_ELAPSED_MS = 250

type PlaybackOptions = {
  day: ReplayDay | null
  playing: boolean
  speed: ReplaySpeed
  at: number
  onAdvance(at: number): void
  onEnded(): void
}

export function useReplayPlayback(options: PlaybackOptions): void {
  const latest = useRef(options)
  latest.current = options
  const { playing, day } = options
  useEffect(() => {
    if (!playing || day === null) {
      return
    }
    let last = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      const elapsed = Math.min(now - last, MAX_ELAPSED_MS)
      last = now
      if (document.hidden) {
        return
      }
      const step = stepPlayback(day, latest.current.at, elapsed, latest.current.speed)
      latest.current.onAdvance(step.at)
      if (step.ended) {
        latest.current.onEnded()
      }
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [playing, day])
}
