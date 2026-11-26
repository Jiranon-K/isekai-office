import type { Choice, OfficeAgent, SessionDetail } from '@shared/types'
import { useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/badge'
import { AllowIcon, DenyIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent, PopoverHeader, PopoverTitle } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import type { Loadable } from '@/lib/api'
import { isTyping } from '@/lib/keyboard'
import type { AgentLocator } from '@/office/use-office-canvas'
import { choiceExcerpt, choiceForKey, parseChoices } from './choice-logic'
import { decisionLocked, lastScreenLines, STATE_LABELS } from './panel-logic'
import { useCommand, type CommandStatus } from './use-command'
import { useSession } from './use-session'

type QuickReplyProps = {
  agent: OfficeAgent
  locateRef: React.RefObject<AgentLocator | null>
  onExpand(): void
  onClose(): void
}

const SCREEN_LINES = 6

function centreRect(): DOMRect {
  return new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0)
}

function focusRoom(): void {
  document.querySelector<HTMLElement>('[role="application"]')?.focus()
}

function ScreenLines({ session, choices }: { session: Loadable<SessionDetail>; choices: Choice[] }): React.JSX.Element {
  if (!session.data && session.loading) {
    return <Skeleton className="h-24 w-full" />
  }
  const screen = session.data?.screen
  if (!screen) {
    return <p className="rounded-md bg-muted p-2 text-small text-muted-foreground">อ่านหน้าจอ terminal ไม่ได้</p>
  }
  return (
    <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-caption whitespace-pre-wrap">
      {(choices.length > 0 && choiceExcerpt(screen)) || lastScreenLines(screen, SCREEN_LINES)}
    </pre>
  )
}

function Failure({ status }: { status: CommandStatus }): React.JSX.Element | null {
  if (status.kind !== 'failed') {
    return null
  }
  return (
    <p role="alert" className="text-caption text-tint-red-fg">
      ส่งไม่สำเร็จ ({status.reason}) ลองใหม่อีกครั้ง
    </p>
  )
}

function ChoiceList({
  choices,
  status,
  disabled,
  onChoose,
  onDeny
}: {
  choices: Choice[]
  status: CommandStatus
  disabled: boolean
  onChoose(choice: number): void
  onDeny(): void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice, index) => (
        <Button
          key={choice.number}
          variant={index === 0 ? 'default' : 'outline'}
          className="h-auto min-h-9 justify-start py-1.5 text-left whitespace-normal"
          disabled={disabled}
          onClick={() => onChoose(choice.number)}
        >
          {choice.number}. {choice.label}
        </Button>
      ))}
      <Button variant="outline" disabled={disabled} onClick={onDeny}>
        <DenyIcon />
        ปฏิเสธ
      </Button>
      <Failure status={status} />
    </div>
  )
}

function Decision({
  status,
  disabled,
  onAllow,
  onDeny
}: {
  status: CommandStatus
  disabled: boolean
  onAllow(): void
  onDeny(): void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button className="flex-1" disabled={disabled} onClick={onAllow}>
          <AllowIcon />
          อนุญาต
        </Button>
        <Button variant="outline" className="flex-1" disabled={disabled} onClick={onDeny}>
          <DenyIcon />
          ปฏิเสธ
        </Button>
      </div>
      <Failure status={status} />
    </div>
  )
}

export function QuickReply({ agent, locateRef, onExpand, onClose }: QuickReplyProps): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null)
  const session = useSession(agent)
  const command = useCommand(agent.id)
  const [answeredAt, setAnsweredAt] = useState<number | null>(null)
  const locked = decisionLocked(command.status.kind, answeredAt, agent.updatedAt)
  const screen = session.data?.screen
  const choices = useMemo(() => (screen ? parseChoices(screen) : []), [screen])
  function decide(action: 'allow' | 'deny'): void {
    setAnsweredAt(agent.updatedAt)
    void command.run(action)
  }
  function choose(choice: number): void {
    setAnsweredAt(agent.updatedAt)
    void command.run('choose', undefined, choice)
  }
  function onKeyDown(event: React.KeyboardEvent): void {
    const choice = choiceForKey(event.key, choices)
    if (choice === null || locked || agent.terminal === null) {
      return
    }
    if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
      return
    }
    event.preventDefault()
    choose(choice)
  }
  const anchor = useMemo(
    () => ({ current: { getBoundingClientRect: () => locateRef.current?.(agent.id) ?? centreRect() } }),
    [agent.id, locateRef]
  )
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent
        ref={contentRef}
        side="top"
        sideOffset={8}
        collisionPadding={12}
        updatePositionStrategy="always"
        aria-label={`ตอบ ${agent.title}`}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          contentRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          focusRoom()
        }}
        className="flex w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-3"
      >
        <PopoverHeader>
          <PopoverTitle className="truncate text-body-strong">{agent.title}</PopoverTitle>
          <div>
            <Badge variant="amber">{STATE_LABELS[agent.state]}</Badge>
          </div>
        </PopoverHeader>
        <ScreenLines session={session} choices={choices} />
        {agent.terminal === null ? (
          <p role="note" className="rounded-md bg-muted p-2 text-small text-muted-foreground">
            session นี้ไม่มี terminal ที่เขียนได้ ตอบจากที่นี่ไม่ได้
          </p>
        ) : choices.length > 0 ? (
          <ChoiceList choices={choices} status={command.status} disabled={locked} onChoose={choose} onDeny={() => decide('deny')} />
        ) : (
          <Decision status={command.status} disabled={locked} onAllow={() => decide('allow')} onDeny={() => decide('deny')} />
        )}
        <Button variant="ghost" size="sm" onClick={onExpand}>
          เปิดแผงเต็ม
        </Button>
      </PopoverContent>
    </Popover>
  )
}
