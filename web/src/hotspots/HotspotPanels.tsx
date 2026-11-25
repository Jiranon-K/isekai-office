import type { BoardSnapshot, OfficeSnapshot } from '@shared/types'
import type { Loadable } from '@/lib/api'
import type { PanelId } from '@/lib/route'
import type { Theme } from '@/lib/theme'
import { hotspotById } from '@/office/office-hotspots'
import { ArchivePanel } from './ArchivePanel'
import { BarPanel } from './BarPanel'
import { HearthPanel } from './HearthPanel'
import { HotspotPopover, type PanelSide } from './HotspotPopover'
import { OrbPanel } from './OrbPanel'
import { RosterPanel } from './RosterPanel'
import { WorldPanel } from './WorldPanel'

type PopoverPanelId = Exclude<PanelId, 'questBoard'>

type HotspotPanelsProps = {
  open: PanelId | null
  office: Loadable<OfficeSnapshot>
  board: Loadable<BoardSnapshot>
  theme: Theme
  onThemeChange(theme: Theme): void
  onSelectAgent(agentId: string): void
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
    return <RosterPanel office={props.office} onSelect={props.onSelectAgent} />
  }
  if (id === 'door') {
    return <WorldPanel theme={props.theme} onThemeChange={props.onThemeChange} />
  }
  if (id === 'orb') {
    return <OrbPanel agents={agents} contextWindow={props.office.data?.contextWindow ?? 0} onSelect={props.onSelectAgent} />
  }
  if (id === 'barShelf') {
    return <BarPanel agents={agents} board={props.board.data} onSelect={props.onSelectAgent} />
  }
  if (id === 'hearth') {
    return <HearthPanel office={props.office} />
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
