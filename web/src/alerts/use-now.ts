import { useEffect, useState } from 'react'
import { clockRuns } from './quiet-logic'

export function useNow(intervalMs: number, alertsEnabled: boolean): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    function stop(): void {
      if (timer === null) {
        return
      }
      clearInterval(timer)
      timer = null
    }

    function sync(): void {
      if (!clockRuns(alertsEnabled, document.visibilityState)) {
        stop()
        return
      }
      setNow(Date.now())
      if (timer === null) {
        timer = setInterval(() => setNow(Date.now()), intervalMs)
      }
    }

    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [intervalMs, alertsEnabled])

  return now
}
