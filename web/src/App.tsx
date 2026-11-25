import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QuestBoard } from '@/board/QuestBoard'
import { HotspotPanels } from '@/hotspots/HotspotPanels'
import { waitingCount } from '@/hotspots/panel-data'
import { StatusChip } from '@/hotspots/StatusChip'
import { ThemeDock } from '@/hotspots/ThemeDock'
import { useBoard, useOfficeFeed } from '@/lib/api'
import { closePanel, mergeQuery, parseRoute, selectAgent, togglePanel } from '@/lib/route'
import { toggleMode, useTheme } from '@/lib/theme'
import { replyMode } from '@/notify/notify-logic'
import { useAlertSetting } from '@/notify/use-alert-setting'
import { useWaitingAlerts } from '@/notify/use-waiting-alerts'
import type { HotspotId } from '@/office/office-hotspots'
import { OfficeCanvas } from '@/office/OfficeCanvas'
import type { AgentLocator } from '@/office/use-office-canvas'
import { CommandPanel } from '@/panel/CommandPanel'
import { QuickReply } from '@/panel/QuickReply'

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
      <StatusChip office={office} onOpen={() => openHotspot('hearth')} />
      {boardOpen ? null : <ThemeDock theme={theme} onThemeChange={setTheme} alerts={alerts} />}
      <HotspotPanels
        open={route.open}
        office={office}
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
