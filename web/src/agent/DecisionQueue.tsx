import type { OfficeAgent } from '@shared/types'
import { useEffect } from 'react'
import { waitingQueue } from '@/alerts/jump-logic'
import { useNow } from '@/alerts/use-now'
import { QueueBody } from './QueueBody'
import { currentOf, nextOf, type QueueState } from './queue-logic'
import { usePrefetchedSession } from './use-prefetched-session'

const EMPTY_CLOSE_MS = 1000
const CLOCK_MS = 10_000

type DecisionQueueProps = {
  state: QueueState
  agents: readonly OfficeAgent[]
  onSkip(): void
  onAnswered(agentId: string): void
  onExpand(agentId: string): void
  onClose(): void
}

function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 z-dropdown flex items-center justify-center p-3">
      <section
        role="dialog"
        aria-label="ตอบทีละคน"
        className="pointer-events-auto flex max-h-full w-96 max-w-full flex-col gap-3 overflow-y-auto rounded-lg bg-popover p-4 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
      >
        {children}
      </section>
    </div>
  )
}

function NobodyWaits({ onClose }: { onClose(): void }): React.JSX.Element {
  useEffect(() => {
    const timer = setTimeout(onClose, EMPTY_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [onClose])
  return (
    <Frame>
      <p role="status" className="py-4 text-center text-body-strong">
        ไม่มีใครรอแล้ว
      </p>
    </Frame>
  )
}

export function DecisionQueue({ state, agents, onSkip, onAnswered, onExpand, onClose }: DecisionQueueProps): React.JSX.Element {
  const current = currentOf(state, agents)
  const prefetched = usePrefetchedSession(nextOf(state, agents))
  const now = useNow(CLOCK_MS, true)
  if (current === null) {
    return <NobodyWaits onClose={onClose} />
  }
  const waiting = waitingQueue(agents)
  return (
    <Frame>
      <QueueBody
        key={current.id}
        agent={current}
        state={state}
        position={waiting.findIndex((agent) => agent.id === current.id) + 1}
        total={waiting.length}
        now={now}
        prefetched={prefetched}
        onSkip={onSkip}
        onAnswered={onAnswered}
        onExpand={onExpand}
        onClose={onClose}
      />
    </Frame>
  )
}
