import type { OfficeAgent } from '@shared/types'
import type { ComponentProps } from 'react'
import type { OfficeCanvas } from '@/office/OfficeCanvas'
import type { HotspotId } from '@/office/scene/hotspots'
import type { Replay } from './use-replay'

type CanvasOverrides = Partial<ComponentProps<typeof OfficeCanvas>>

const NO_QUIET: ReadonlyMap<string, number> = new Map()
const NO_PARTIES: ComponentProps<typeof OfficeCanvas>['partyByAgent'] = new Map()
const NO_AGENTS: OfficeAgent[] = []

export function replayCanvas(replay: Replay, onHotspot: (id: HotspotId) => void): CanvasOverrides {
  if (!replay.active) {
    return {}
  }
  return {
    agents: replay.status === 'ready' ? replay.agents : NO_AGENTS,
    sourceReady: true,
    quiet: NO_QUIET,
    partyByAgent: NO_PARTIES,
    selectedId: replay.picked?.agentId ?? null,
    onSelect: replay.pick,
    onHotspot: (id) => (id === 'hearth' ? onHotspot(id) : undefined),
    groupOf: replay.groupOf,
    snap: replay.snap
  }
}
