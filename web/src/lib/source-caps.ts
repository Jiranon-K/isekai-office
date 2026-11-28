import { useSyncExternalStore } from 'react'
import type { SourceCaps } from '@shared/types'

export const READ_ONLY_REASON = 'source นี้อ่านได้อย่างเดียว'
export const EXTERNAL_READ_ONLY_REASON = 'session นี้เปิดจากข้างนอก ส่งคำสั่งจากที่นี่ไม่ได้'

const ALL_CAPS: SourceCaps = { command: true, spawn: true, screen: true }

const listeners = new Set<() => void>()

let current = ALL_CAPS

function sameCaps(first: SourceCaps, second: SourceCaps): boolean {
  return first.command === second.command && first.spawn === second.spawn && first.screen === second.screen
}

export function publishSourceCaps(caps: SourceCaps | undefined): void {
  const next = caps ?? ALL_CAPS
  if (sameCaps(current, next)) {
    return
  }
  current = next
  for (const listener of listeners) {
    listener()
  }
}

export function currentSourceCaps(): SourceCaps {
  return current
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSourceCaps(): SourceCaps {
  return useSyncExternalStore(subscribe, currentSourceCaps)
}
