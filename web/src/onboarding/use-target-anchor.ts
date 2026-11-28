import { useEffect, useRef, type RefObject } from 'react'
import { hotspotById, hotspotBounds } from '@/office/scene/hotspots'
import type { AgentLocator } from '@/office/use-office-canvas'
import { roomRectToViewport } from '@/office/use-room-view'
import type { TourTarget } from './tour-logic'

const REVEAL_MARGIN = 24

export type TargetAnchor = { getBoundingClientRect(): DOMRect }

function reception(): DOMRect {
  return roomRectToViewport(hotspotBounds(hotspotById('reception')))
}

export function targetRect(target: TourTarget, locate: AgentLocator | null | undefined): DOMRect {
  if (target.kind === 'hotspot') {
    return roomRectToViewport(hotspotBounds(hotspotById(target.id)))
  }
  return locate?.(target.id) ?? reception()
}

function targetKey(target: TourTarget): string {
  return `${target.kind}:${target.id}`
}

function revealInScroller(rect: DOMRect): void {
  const scroller = document.querySelector('[data-room-canvas]')?.parentElement
  if (!scroller) {
    return
  }
  const frame = scroller.getBoundingClientRect()
  if (rect.bottom > frame.bottom) {
    scroller.scrollTop += rect.bottom - frame.bottom + REVEAL_MARGIN
    return
  }
  if (rect.top < frame.top) {
    scroller.scrollTop -= frame.top - rect.top + REVEAL_MARGIN
  }
}

export function useTargetAnchor(target: TourTarget, locateRef: RefObject<AgentLocator | null>): RefObject<TargetAnchor> {
  const latest = useRef(target)
  const key = targetKey(target)
  useEffect(() => {
    latest.current = target
    revealInScroller(targetRect(target, locateRef.current))
  }, [key, locateRef])
  return useRef<TargetAnchor>({ getBoundingClientRect: () => targetRect(latest.current, locateRef.current) })
}
