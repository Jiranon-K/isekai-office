import type { AgentState, OfficeAgent } from '@shared/types'
import { useCallback } from 'react'
import type { Mode, World } from '@/lib/theme'
import { HOTSPOTS, type Hotspot, type HotspotId } from './scene/hotspots'
import { useOfficeCanvas, type AgentLocator } from './use-office-canvas'

type OfficeCanvasProps = {
  agents: OfficeAgent[]
  orcaRunning: boolean
  contextWindow: number
  quiet: ReadonlyMap<string, number>
  selectedId: string | null
  onSelect: (id: string | null) => void
  onHotspot: (id: HotspotId) => void
  openHotspot: HotspotId | null
  boardWaiting: number
  world: World
  mode: Mode
  paused: boolean
  locateRef: React.RefObject<AgentLocator | null>
}

const STATE_LABELS: Record<AgentState, string> = {
  working: 'กำลังทำงาน',
  waiting: 'รอคำสั่ง',
  blocked: 'ติดขัด',
  done: 'เสร็จแล้ว',
}

const REVEALED_BUTTON =
  'focus-ring sr-only focus:not-sr-only focus:absolute focus:bottom-16 focus:left-3 focus:rounded-md focus:border focus:bg-card focus:px-3 focus:py-2 focus:text-small focus:text-foreground'

function hotspotState(hotspot: Hotspot, openHotspot: HotspotId | null, mode: Mode): React.AriaAttributes {
  if (hotspot.action.kind === 'toggleMode') {
    return { 'aria-pressed': mode === 'night' }
  }
  return { 'aria-expanded': openHotspot === hotspot.id }
}

export function OfficeCanvas(props: OfficeCanvasProps): React.JSX.Element {
  const { agents, selectedId, onSelect, onHotspot, openHotspot, mode, locateRef } = props
  const { containerRef, canvasRef, handleClick, handlePointerMove, handlePointerLeave, highlight } = useOfficeCanvas(props, { onSelect, onHotspot, locateRef })

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        onSelect(null)
        return
      }
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
        return
      }
      if (agents.length === 0) {
        return
      }
      event.preventDefault()
      const step = event.key === 'ArrowRight' ? 1 : -1
      const current = agents.findIndex((agent) => agent.id === selectedId)
      const next = (current + step + agents.length) % agents.length
      onSelect(agents[next]?.id ?? null)
    },
    [agents, selectedId, onSelect],
  )

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="ห้องโถงกิลด์ Isekai Office ของในห้องคือเมนู กด Tab เพื่อไปยังของแต่ละชิ้นและเอเจนต์แต่ละตัว ใช้ลูกศรซ้ายขวาเพื่อเลือกเอเจนต์ กด ? ค้างเพื่อดูของที่คลิกได้ และ Escape เพื่อปิด"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="focus-ring absolute inset-0 focus-visible:-outline-offset-4!"
    >
      <div className="size-full overflow-x-hidden overflow-y-auto">
        <canvas
          ref={canvasRef}
          data-room-canvas=""
          className="block aspect-5/3 min-h-full w-full"
          onClick={handleClick}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        />
      </div>
      <ul aria-label="ของในห้องที่เปิดได้">
        {HOTSPOTS.map((hotspot) => (
          <li key={hotspot.id}>
            <button
              type="button"
              {...hotspotState(hotspot, openHotspot, mode)}
              onClick={() => onHotspot(hotspot.id)}
              onFocus={() => highlight(hotspot.id)}
              onBlur={() => highlight(null)}
              className={REVEALED_BUTTON}
            >
              {hotspot.label}: {hotspot.hint}
            </button>
          </li>
        ))}
      </ul>
      <ul aria-label="เอเจนต์">
        {agents.map((agent) => (
          <li key={agent.id}>
            <button type="button" aria-pressed={agent.id === selectedId} onClick={() => onSelect(agent.id)} className={REVEALED_BUTTON}>
              {agent.title} ({STATE_LABELS[agent.state]})
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
