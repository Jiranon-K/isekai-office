import { useEffect, useRef } from 'react'
import { withReplay } from '@/lib/route'

const WRITE_INTERVAL_MS = 1000

export function writeReplayUrl(date: string | null, at: number | null): void {
  const next = withReplay(location.search, date === null ? null : { date, at }) || location.pathname
  history.replaceState(null, '', next)
}

export function useReplayUrl(date: string | null, at: number, ready: boolean, playing: boolean): void {
  const lastWrite = useRef(0)
  useEffect(() => {
    if (date === null || !ready) {
      return
    }
    const now = Date.now()
    if (playing && now - lastWrite.current < WRITE_INTERVAL_MS) {
      return
    }
    lastWrite.current = now
    writeReplayUrl(date, at)
  }, [date, at, ready, playing])
}
