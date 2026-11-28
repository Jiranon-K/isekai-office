import { useMemo, useRef, useState } from 'react'
import type { OfficeAgent } from '@shared/types'
import { Badge } from '@/components/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent, PopoverHeader, PopoverTitle } from '@/components/ui/popover'
import { isTyping } from '@/lib/keyboard'
import { EXTERNAL_READ_ONLY_REASON, READ_ONLY_REASON, useSourceCaps } from '@/lib/source-caps'
import type { AgentLocator } from '@/office/use-office-canvas'
import { choiceForKey, parseChoices } from './choice-logic'
import { ChoiceList, Decision, ScreenLines } from './DecisionControls'
import { decisionLocked, STATE_LABELS } from './panel-logic'
import { useCommand } from './use-command'
import { useSession } from './use-session'

type QuickReplyProps = {
  agent: OfficeAgent
  locateRef: React.RefObject<AgentLocator | null>
  onExpand(): void
  onClose(): void
}

function centreRect(): DOMRect {
  return new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0)
}

function focusRoom(): void {
  document.querySelector<HTMLElement>('[role="application"]')?.focus()
}

export function QuickReply({ agent, locateRef, onExpand, onClose }: QuickReplyProps): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null)
  const session = useSession(agent)
  const command = useCommand(agent.id)
  const caps = useSourceCaps()
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
    if (choice === null || locked || agent.terminal === null || !caps.command) {
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
        className="flex max-h-(--radix-popover-content-available-height) w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-3 overflow-y-auto"
      >
        <PopoverHeader>
          <PopoverTitle className="truncate text-body-strong">{agent.title}</PopoverTitle>
          <div>
            <Badge variant="amber">{STATE_LABELS[agent.state]}</Badge>
          </div>
        </PopoverHeader>
        <ScreenLines session={session} choices={choices} />
        {agent.terminal === null || !caps.command ? (
          <p role="note" className="rounded-md bg-muted p-2 text-small text-muted-foreground">
            {caps.command ? EXTERNAL_READ_ONLY_REASON : READ_ONLY_REASON}
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
