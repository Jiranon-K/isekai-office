import { useCallback, useEffect, useRef } from 'react'
import { createOfficeEngine, type OfficeEngine, type OfficeInput } from './office-engine'
import { hotspotBounds, hotspotById, type HotspotId } from './office-hotspots'
import { computeView, scrollToShow, toScreenBox } from './office-view'

const SEEN_KEY = 'isekai-office-hotspots-seen'

export type AgentLocator = (agentId: string) => DOMRect | null

type CanvasHandlers = {
  onSelect: (id: string | null) => void
  onHotspot: (id: HotspotId) => void
  locateRef: React.RefObject<AgentLocator | null>
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))
}

function isRevealKey(event: KeyboardEvent): boolean {
  return event.key === '?' || (event.code === 'Slash' && event.shiftKey)
}

function pulseOnFirstVisit(engine: OfficeEngine): void {
  if (localStorage.getItem(SEEN_KEY)) {
    return
  }
  localStorage.setItem(SEEN_KEY, '1')
  engine.pulse()
}

function revealHotspot(canvas: HTMLCanvasElement, id: HotspotId): void {
  const scroller = canvas.parentElement
  if (!scroller) {
    return
  }
  const view = computeView(canvas.clientWidth, canvas.clientHeight, 1)
  const box = toScreenBox(view, hotspotBounds(hotspotById(id)))
  scroller.scrollTop = scrollToShow(box, scroller.scrollTop, scroller.clientHeight)
}

function locateAgent(canvas: HTMLCanvasElement, engine: OfficeEngine, agentId: string): DOMRect | null {
  const rect = engine.agentRect(agentId)
  if (!rect) {
    return null
  }
  const bounds = canvas.getBoundingClientRect()
  const box = toScreenBox(computeView(bounds.width, bounds.height, 1), rect)
  return new DOMRect(bounds.left + box.left, bounds.top + box.top, box.width, box.height)
}

function useRevealKey(engineRef: React.RefObject<OfficeEngine | null>): void {
  useEffect(() => {
    const show = (event: KeyboardEvent): void => {
      if (isRevealKey(event) && !isTyping(event.target)) {
        engineRef.current?.setReveal(true)
      }
    }
    const hide = (): void => engineRef.current?.setReveal(false)
    window.addEventListener('keydown', show)
    window.addEventListener('keyup', hide)
    window.addEventListener('blur', hide)
    return () => {
      window.removeEventListener('keydown', show)
      window.removeEventListener('keyup', hide)
      window.removeEventListener('blur', hide)
    }
  }, [engineRef])
}

export function useOfficeCanvas(input: OfficeInput, { onSelect, onHotspot, locateRef }: CanvasHandlers) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<OfficeEngine | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) {
      return
    }
    const engine = createOfficeEngine(canvas)
    engineRef.current = engine
    locateRef.current = (agentId) => locateAgent(canvas, engine, agentId)
    const measure = (): void => {
      const bounds = canvas.getBoundingClientRect()
      engine.resize(bounds.width, bounds.height, window.devicePixelRatio || 1)
    }
    measure()
    pulseOnFirstVisit(engine)
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(canvas)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      engine.destroy()
      locateRef.current = null
      engineRef.current = null
    }
  }, [locateRef])

  useRevealKey(engineRef)

  const { agents, orcaRunning, contextWindow, selectedId, world, mode, paused, boardWaiting, openHotspot } = input
  useEffect(() => {
    engineRef.current?.update({ agents, orcaRunning, contextWindow, selectedId, world, mode, paused, boardWaiting, openHotspot })
  }, [agents, orcaRunning, contextWindow, selectedId, world, mode, paused, boardWaiting, openHotspot])

  useEffect(() => {
    if (openHotspot && canvasRef.current) {
      revealHotspot(canvasRef.current, openHotspot)
    }
  }, [openHotspot])

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const target = engineRef.current?.pick(event.clientX, event.clientY) ?? null
      if (target?.kind === 'hotspot') {
        onHotspot(target.id)
        return
      }
      onSelect(target?.id ?? null)
    },
    [onSelect, onHotspot],
  )

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const target = engineRef.current?.pick(event.clientX, event.clientY) ?? null
    event.currentTarget.style.cursor = target ? 'pointer' : 'default'
    engineRef.current?.setHover(target?.kind === 'hotspot' ? target.id : null)
  }, [])

  const highlight = useCallback((id: HotspotId | null) => {
    engineRef.current?.setHover(id)
    if (id && canvasRef.current) {
      revealHotspot(canvasRef.current, id)
    }
  }, [])
  const handlePointerLeave = useCallback(() => engineRef.current?.setHover(null), [])

  return { containerRef, canvasRef, handleClick, handlePointerMove, handlePointerLeave, highlight }
}
