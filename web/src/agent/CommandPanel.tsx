import type { OfficeAgent, SessionDetail } from '@shared/types'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/badge'
import { AllowIcon, DenyIcon, TerminalIcon, XIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { READ_ONLY_REASON, useSourceCaps } from '@/lib/source-caps'
import { CompactButton } from './CompactButton'
import { CommandComposer } from './CommandComposer'
import { formatContextLoad, lastScreenLines, needsDecision, STATE_LABELS } from './panel-logic'
import { OrdersSection } from './OrdersSection'
import { SessionGold } from '@/ledger/SessionGold'
import { PanelTabs, type PanelTab } from './PanelTabs'
import { Transcript } from './Transcript'
import { useCommand } from './use-command'
import { useSession } from './use-session'

type CommandPanelProps = { agent: OfficeAgent; contextWindow: number; onClose(): void }

const SCREEN_LINES = 14

function ScreenBlock({ session, agent }: { session: SessionDetail | null; agent: OfficeAgent }): React.JSX.Element | null {
  if (!session?.screen || !needsDecision(agent.state)) {
    return null
  }
  return (
    <section aria-labelledby="terminal-screen" className="flex flex-col gap-1">
      <h3 id="terminal-screen" className="flex items-center gap-1.5 text-small font-medium">
        <TerminalIcon />
        หน้าจอ terminal
      </h3>
      <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 font-mono text-caption whitespace-pre-wrap">
        {lastScreenLines(session.screen, SCREEN_LINES)}
      </pre>
    </section>
  )
}

function DecisionButtons({ disabled, onAllow, onDeny }: { disabled: boolean; onAllow(): void; onDeny(): void }): React.JSX.Element {
  return (
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
  )
}

function PanelHeader({ agent, contextWindow, onClose }: CommandPanelProps): React.JSX.Element {
  const location = [agent.repo, agent.workspace].filter(Boolean).join(' / ')
  const contextLoad = formatContextLoad(agent.contextTokens, contextWindow)
  return (
    <header className="flex items-start gap-2 border-b p-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="truncate text-body-strong">{agent.title}</h2>
        {location ? <p className="truncate text-caption text-muted-foreground">{location}</p> : null}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={needsDecision(agent.state) ? 'amber' : 'muted'}>{STATE_LABELS[agent.state]}</Badge>
          {agent.tool ? (
            <Badge variant="outline" className="font-mono">
              {agent.tool}
            </Badge>
          ) : null}
          {contextLoad ? (
            <Badge variant="outline" className="font-mono" title="context ที่ session นี้ถืออยู่">
              {contextLoad}
            </Badge>
          ) : null}
          <SessionGold agent={agent} />
          <CompactButton agent={agent} contextWindow={contextWindow} />
        </div>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="ปิดแผงคำสั่ง" onClick={onClose}>
        <XIcon />
      </Button>
    </header>
  )
}

export function CommandPanel({ agent, contextWindow, onClose }: CommandPanelProps): React.JSX.Element {
  const session = useSession(agent)
  const command = useCommand(agent.id)
  const caps = useSourceCaps()
  const readonly = agent.terminal === null || !caps.command
  const sending = command.status.kind === 'sending'
  const [tab, setTab] = useState<PanelTab>('chat')

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <aside
      aria-label={`แผงคำสั่งของ ${agent.title}`}
      className="absolute top-3 right-3 bottom-3 z-overlay flex w-[380px] max-w-[calc(100%-1.5rem)] animate-peek-in flex-col rounded-lg border bg-card shadow-lg"
    >
      <PanelHeader agent={agent} contextWindow={contextWindow} onClose={onClose} />
      <PanelTabs tab={tab} onChange={setTab} />
      {tab === 'orders' ? <OrdersSection agentId={agent.id} /> : null}
      <div data-transcript-scroller="" data-off={tab === 'orders'} className="flex flex-1 flex-col gap-3 overflow-y-auto p-3 data-[off=true]:hidden">
        <Transcript key={agent.id} {...session} />
        <ScreenBlock session={session.data} agent={agent} />
      </div>
      <footer className="flex flex-col gap-2 border-t p-3">
        {readonly ? (
          <p role="note" className="rounded-md bg-muted p-2 text-small text-muted-foreground">
            {caps.command ? 'session นี้เป็นแบบ chat หรือไม่พบ terminal ที่เขียนได้ ส่งคำสั่งจากที่นี่ไม่ได้' : READ_ONLY_REASON}
          </p>
        ) : null}
        {needsDecision(agent.state) ? (
          <DecisionButtons
            disabled={readonly || sending}
            onAllow={() => void command.run('allow')}
            onDeny={() => void command.run('deny')}
          />
        ) : null}
        <CommandComposer
          disabled={readonly}
          status={command.status}
          onPrompt={(text) => command.run('prompt', text)}
          onEscape={() => void command.run('escape')}
        />
      </footer>
    </aside>
  )
}
