import type { OfficeAgent } from '@shared/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/kbd'
import { READ_ONLY_REASON, useSourceCaps } from '@/lib/source-caps'
import { parseChoices } from './choice-logic'
import { ChoiceList, Decision, ScreenLines } from './DecisionControls'
import { decisionLocked } from './panel-logic'
import { QueueComposer } from './QueueComposer'
import { QueueHeader } from './QueueHeader'
import { answerLockHeld, canAnswer, keyAnswers, canWriteTo, loadedScreen, prefetchedScreen, restartGuard, type QueueKey, type QueueState } from './queue-logic'
import { useCommand } from './use-command'
import type { PrefetchedSession } from './use-prefetched-session'
import { useQueueKeys } from './use-queue-keys'
import { useSession } from './use-session'

const MOVE_ON_MS = 1500

type QueueBodyProps = {
  agent: OfficeAgent
  state: QueueState
  position: number
  total: number
  now: number
  prefetched: PrefetchedSession | null
  onSkip(): void
  onAnswered(): void
  onExpand(agentId: string): void
  onClose(): void
}

function QueueHints(): React.JSX.Element {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
      <span><Kbd>1-9</Kbd> ตอบ</span>
      <span><Kbd>x</Kbd> ปฏิเสธ</span>
      <span><Kbd>s</Kbd> ข้าม</span>
      <span><Kbd>o</Kbd> แผงเต็ม</span>
      <span><Kbd>Esc</Kbd> ปิด</span>
    </p>
  )
}

function useQueueSession(agent: OfficeAgent, prefetched: PrefetchedSession | null): ReturnType<typeof useSession> {
  const live = useSession(agent)
  const data = loadedScreen(live.data, live.loadedFor, agent.updatedAt)
  const early = prefetchedScreen(prefetched, agent.id, agent.updatedAt)
  if (data === null && early !== null) {
    return { ...live, data: early, loading: false }
  }
  return { ...live, data, loading: data === null && live.error === null ? true : live.loading }
}

export function QueueBody(props: QueueBodyProps): React.JSX.Element {
  const { agent, state, onSkip, onAnswered, onExpand, onClose } = props
  const session = useQueueSession(agent, props.prefetched)
  const command = useCommand(agent.id)
  const [answeredAt, setAnsweredAt] = useState<number | null>(null)
  const answeredFor = useRef<number | null>(null)
  const screen = session.data?.screen ?? null
  const choices = useMemo(() => (screen ? parseChoices(screen) : []), [screen])
  const locked = decisionLocked(command.status.kind, answeredAt, agent.updatedAt)
  const caps = useSourceCaps()
  const canWrite = canWriteTo(agent.terminal, caps.command)
  const boardOpen = state.boardOpen === true
  const needsComposer = canWrite && agent.state === 'blocked' && choices.length === 0
  const screenLoaded = session.data !== null || session.error !== null
  const arrival = useRef<{ screenFor: number | null; at: number }>({ screenFor: null, at: 0 })
  const screenFor = screen === null ? null : agent.updatedAt
  if (arrival.current.screenFor !== screenFor) {
    arrival.current = { screenFor, at: Date.now() }
  }

  useEffect(() => {
    if (command.status.kind !== 'sent') {
      return
    }
    const timer = setTimeout(onAnswered, MOVE_ON_MS)
    return () => clearTimeout(timer)
  }, [command.status.kind, onAnswered])

  async function answer(send: () => Promise<boolean>): Promise<boolean> {
    if (answerLockHeld(answeredFor.current, agent.updatedAt, screen !== null)) {
      return false
    }
    const answeredAtStart = agent.updatedAt
    answeredFor.current = answeredAtStart
    setAnsweredAt(answeredAtStart)
    const sent = await send()
    answeredFor.current = sent ? answeredAtStart : null
    return sent
  }

  function answerAllowed(): boolean {
    return canAnswer(restartGuard(state, arrival.current.at), Date.now(), screenLoaded, locked)
  }

  function onPrompt(text: string): Promise<boolean> {
    if (!answerAllowed()) {
      return Promise.resolve(false)
    }
    return answer(() => command.run('prompt', text))
  }

  function onKey(key: QueueKey): void {
    if (key.kind === 'close') {
      onClose()
      return
    }
    if (key.kind === 'expand') {
      onExpand(agent.id)
      return
    }
    if (key.kind === 'skip') {
      onSkip()
      return
    }
    if (!keyAnswers(key) || !answerAllowed()) {
      return
    }
    if (!canWrite || needsComposer || screen === null) {
      return
    }
    if (key.kind === 'deny') {
      void answer(() => command.run('deny'))
      return
    }
    const send = choices.length > 0 ? () => command.run('choose', undefined, key.choice) : () => command.run('allow')
    void answer(send)
  }

  useQueueKeys({ choices, boardOpen, onKey })

  return (
    <>
      <QueueHeader agent={agent} position={props.position} total={props.total} now={props.now} onClose={onClose} />
      {needsComposer ? (
        <p className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-small whitespace-pre-wrap">{agent.lastMessage ?? 'ไม่มีข้อความล่าสุด'}</p>
      ) : (
        <ScreenLines session={session} choices={choices} />
      )}
      {!canWrite ? (
        <p role="note" className="rounded-md bg-muted p-2 text-small text-muted-foreground">
          {caps.command ? 'ตอบจากที่นี่ไม่ได้' : READ_ONLY_REASON}
        </p>
      ) : needsComposer ? (
        <QueueComposer disabled={locked || boardOpen} status={command.status} onEscape={onClose} onPrompt={onPrompt} />
      ) : choices.length > 0 ? (
        <ChoiceList choices={choices} status={command.status} disabled={locked} onChoose={(choice) => onKey({ kind: 'choose', choice })} onDeny={() => onKey({ kind: 'deny' })} />
      ) : (
        <Decision status={command.status} disabled={locked} onAllow={() => onKey({ kind: 'choose', choice: 1 })} onDeny={() => onKey({ kind: 'deny' })} />
      )}
      {command.status.kind === 'sent' ? (
        <p role="status" className="text-caption text-tint-green-fg">
          ส่งคำตอบแล้ว กำลังไปคนถัดไป
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <QueueHints />
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => onKey({ kind: 'skip' })}>
          ข้าม
        </Button>
      </div>
    </>
  )
}
