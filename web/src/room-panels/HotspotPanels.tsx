import type { HandoffDraft } from '@shared/handoff'
import type { BoardSnapshot, OfficeSnapshot } from '@shared/types'
import type { Loadable } from '@/lib/api'
import type { PanelId } from '@/lib/route'
import type { Theme } from '@/lib/theme'
import { hotspotById } from '@/office/scene/hotspots'
import { ArchivePanel } from './ArchivePanel'
import { BarPanel } from './BarPanel'
import { HearthTabs } from './HearthTabs'
import { HotspotPopover, type PanelSide } from './HotspotPopover'
import { OrbPanel } from './OrbPanel'
import { RosterPanel } from './RosterPanel'
import { DoorPanel } from './DoorPanel'

type PopoverPanelId = Exclude<PanelId, 'questBoard'>

type HotspotPanelsProps = {
  open: PanelId | null
  office: Loadable<OfficeSnapshot>
  quiet: ReadonlyMap<string, number>
  board: Loadable<BoardSnapshot>
  theme: Theme
  handoffDraft: HandoffDraft | null
  onThemeChange(theme: Theme): void
  onSelectAgent(agentId: string): void
  onHandoff(draft: HandoffDraft): void
  onClearHandoff(): void
  onClose(): void
}

const SIDES: Record<PopoverPanelId, PanelSide> = {
  reception: 'bottom',
  door: 'top',
  orb: 'left',
  barShelf: 'left',
  hearth: 'bottom',
  archive: 'right'
}

function PanelBody({ id, ...props }: HotspotPanelsProps & { id: PopoverPanelId }): React.JSX.Element {
  const agents = props.office.data?.agents ?? []
  if (id === 'reception') {
    return <RosterPanel office={props.office} board={props.board} quiet={props.quiet} onSelect={props.onSelectAgent} />
  }
  if (id === 'door') {
    return (
      <DoorPanel
        theme={props.theme}
        onThemeChange={props.onThemeChange}
        handoffDraft={props.handoffDraft}
        onClearHandoff={props.onClearHandoff}
      />
    )
  }
  if (id === 'orb') {
    return (
      <OrbPanel
        agents={agents}
        contextWindow={props.office.data?.contextWindow ?? 0}
        onSelect={props.onSelectAgent}
        onHandoff={props.onHandoff}
      />
    )
  }
  if (id === 'barShelf') {
    return <BarPanel agents={agents} board={props.board.data} onSelect={props.onSelectAgent} />
  }
  if (id === 'hearth') {
    return <HearthTabs office={props.office} onSelect={props.onSelectAgent} />
  }
  return <ArchivePanel board={props.board} />
}

export function HotspotPanels(props: HotspotPanelsProps): React.JSX.Element | null {
  const { open } = props
  if (open === null || open === 'questBoard') {
    return null
  }
  return (
    <HotspotPopover key={open} hotspot={hotspotById(open)} side={SIDES[open]} onClose={props.onClose}>
      <PanelBody id={open} {...props} />
    </HotspotPopover>
  )
}
