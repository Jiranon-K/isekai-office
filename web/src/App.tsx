import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QuestBoard } from '@/board/QuestBoard'
import { HotspotPanels } from '@/room-panels/HotspotPanels'
import { waitingCount } from '@/room-panels/panel-data'
import { StatusChip } from '@/room-panels/StatusChip'
import { ThemeDock } from '@/room-panels/ThemeDock'
import { useRecordHidden } from '@/room-panels/use-last-hidden'
import { useBoard, useOfficeFeed } from '@/lib/api'
import { closePanel, mergeQuery, parseRoute, selectAgent, togglePanel } from '@/lib/route'
import { toggleMode, useTheme } from '@/lib/theme'
import { replyMode } from '@/alerts/alert-logic'
import { useAlertSetting } from '@/alerts/use-alert-setting'
import { useJumpKey } from '@/alerts/use-jump-key'
import { useNow } from '@/alerts/use-now'
import { useLoadAlerts } from '@/alerts/use-load-alerts'
import { useQuietAlerts } from '@/alerts/use-quiet-alerts'
import { quietMinutesById } from '@/alerts/quiet-logic'
import { useWaitingAlerts } from '@/alerts/use-waiting-alerts'
import { KeyHints } from '@/room-panels/KeyHints'
import type { HotspotId } from '@/office/scene/hotspots'
import { OfficeCanvas } from '@/office/OfficeCanvas'
import type { AgentLocator } from '@/office/use-office-canvas'
import { CommandPanel } from '@/agent/CommandPanel'
import { QuickReply } from '@/agent/QuickReply'

const CLOCK_MS = 30_000

function useEscape(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) {
      return
    }
    function handle(event: KeyboardEvent): void {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onEscape()
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [active, onEscape])
}

export function App(): React.JSX.Element {
  const [theme, setTheme] = useTheme()
  const [route, setRoute] = useState(() => parseRoute(location.search))
  const office = useOfficeFeed()
  const questBoard = useBoard(true)
  useRecordHidden()

  useEffect(() => history.replaceState(null, '', mergeQuery(location.search, route) || location.pathname), [route])

  const agents = useMemo(() => office.data?.agents ?? [], [office.data])
  const contextWindow = office.data?.contextWindow ?? 0
  const selected = agents.find((agent) => agent.id === route.agentId) ?? null
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const showQuickReply = selected !== null && replyMode(selected, expandedId === selected.id) === 'quick'
  const boardOpen = route.open === 'questBoard'
  const boardWaiting = useMemo(() => waitingCount(questBoard.data, agents), [questBoard.data, agents])
  const pickAgent = useCallback((agentId: string | null) => {
    setExpandedId(null)
    setRoute((current) => selectAgent(current, agentId))
  }, [])
  const alerts = useAlertSetting()
  const alertAgents = office.data?.orcaRunning ? office.data.agents : null
  useWaitingAlerts(alertAgents, alerts.enabled, pickAgent)
  const now = useNow(CLOCK_MS, alerts.enabled)
  const quietAfterMs = office.data?.quietAfterMs ?? Number.POSITIVE_INFINITY
  const quiet = useMemo(() => quietMinutesById(agents, now, quietAfterMs), [agents, now, quietAfterMs])
  useQuietAlerts(alertAgents, now, quietAfterMs, alerts.enabled, pickAgent)
  useLoadAlerts(alertAgents, contextWindow, alerts.enabled, pickAgent)
  useJumpKey({ agents, currentId: route.agentId, boardOpen, onPick: pickAgent })
  const locateRef = useRef<AgentLocator | null>(null)
  const close = useCallback(() => setRoute(closePanel), [])
  const openHotspot = useCallback(
    (id: HotspotId) => {
      if (id === 'windows') {
        setTheme(toggleMode(theme))
        setRoute(closePanel)
        return
      }
      setRoute((current) => togglePanel(current, id))
    },
    [theme, setTheme]
  )
  useEscape(boardOpen && !selected, close)

  return (
    <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
      <h1 className="sr-only">Isekai Office</h1>
      <OfficeCanvas
        agents={agents}
        orcaRunning={office.data?.orcaRunning ?? false}
        contextWindow={contextWindow}
        quiet={quiet}
        selectedId={selected?.id ?? null}
        onSelect={pickAgent}
        onHotspot={openHotspot}
        openHotspot={route.open}
        boardWaiting={boardWaiting}
        world={theme.world}
        mode={theme.mode}
        paused={boardOpen}
        locateRef={locateRef}
      />
      {boardOpen ? <QuestBoard board={questBoard} agents={agents} onSendToAgent={pickAgent} onClose={close} /> : null}
      <KeyHints />
      <StatusChip office={office} onOpen={() => openHotspot('hearth')} />
      {boardOpen ? null : <ThemeDock theme={theme} onThemeChange={setTheme} alerts={alerts} />}
      <HotspotPanels
        open={route.open}
        office={office}
        quiet={quiet}
        board={questBoard}
        theme={theme}
        onThemeChange={setTheme}
        onSelectAgent={pickAgent}
        onClose={close}
      />
      {selected && showQuickReply ? (
        <QuickReply agent={selected} locateRef={locateRef} onExpand={() => setExpandedId(selected.id)} onClose={() => pickAgent(null)} />
      ) : null}
      {selected && !showQuickReply ? <CommandPanel agent={selected} contextWindow={contextWindow} onClose={() => pickAgent(null)} /> : null}
    </div>
  )
}
