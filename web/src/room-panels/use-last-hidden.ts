import { useEffect, useState } from 'react'
import { LAST_HIDDEN_KEY, parseLastSeen } from './log-logic'

function readLastHidden(): number | null {
  try {
    return parseLastSeen(localStorage.getItem(LAST_HIDDEN_KEY))
  } catch {
    return null
  }
}

function writeLastHidden(at: number): void {
  try {
    localStorage.setItem(LAST_HIDDEN_KEY, String(at))
  } catch {
    return
  }
}

export function useRecordHidden(): void {
  useEffect(() => {
    function handle(): void {
      if (document.visibilityState === 'hidden') {
        writeLastHidden(Date.now())
      }
    }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [])
}

export function useLastHidden(): number | null {
  const [lastHidden, setLastHidden] = useState(readLastHidden)
  useEffect(() => {
    function handle(): void {
      if (document.visibilityState === 'visible') {
        setLastHidden(readLastHidden())
      }
    }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [])
  return lastHidden
}
