import { useEffect, useRef } from 'react'
import { withReplay } from '@/lib/route'
import { urlWriteDelay } from './replay-url-logic'

export function writeReplayUrl(date: string | null, at: number | null): void {
  const next = withReplay(location.search, date === null ? null : { date, at }) || location.pathname
  history.replaceState(null, '', next)
}

export function useReplayUrl(date: string | null, at: number, ready: boolean): void {
  const lastWrite = useRef(0)
  useEffect(() => {
    if (date === null || !ready) {
      return
    }
    function write(): void {
      lastWrite.current = Date.now()
      writeReplayUrl(date, at)
    }
    const delay = urlWriteDelay(Date.now(), lastWrite.current)
    if (delay === 0) {
      write()
      return
    }
    const timer = setTimeout(write, delay)
    return () => clearTimeout(timer)
  }, [date, at, ready])
}
