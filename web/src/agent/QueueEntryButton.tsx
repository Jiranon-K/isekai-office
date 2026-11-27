import { createContext, useContext } from 'react'
import { Button } from '@/components/ui/button'

export type QueueEntry = { waiting: number; open(): void }

const MIN_WAITING = 2

const QueueEntryContext = createContext<QueueEntry | null>(null)

export const QueueEntryProvider = QueueEntryContext.Provider

export function QueueEntryButton(): React.JSX.Element | null {
  const entry = useContext(QueueEntryContext)
  if (entry === null || entry.waiting < MIN_WAITING) {
    return null
  }
  return (
    <Button variant="outline" onClick={entry.open}>
      ตอบทีละคน ({entry.waiting})
    </Button>
  )
}
