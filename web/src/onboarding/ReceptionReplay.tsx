import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { hotspotById, hotspotBounds } from '@/office/scene/hotspots'
import { roomRectToViewport, useRoomBox } from '@/office/use-room-view'

const DESK = hotspotBounds(hotspotById('reception'))

function containsPoint(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

type ReceptionReplayProps = { visible: boolean; onReplay(): void }

export function ReceptionReplay({ visible, onReplay }: ReceptionReplayProps): React.JSX.Element | null {
  const [hovered, setHovered] = useState(false)
  const box = useRoomBox(DESK)
  useEffect(() => {
    if (!visible) {
      return
    }
    const track = (event: PointerEvent): void => {
      setHovered(containsPoint(roomRectToViewport(DESK), event.clientX, event.clientY))
    }
    window.addEventListener('pointermove', track)
    return () => window.removeEventListener('pointermove', track)
  }, [visible])
  if (!visible || !hovered) {
    return null
  }
  return (
    <div className="fixed z-dropdown -translate-1/2" style={{ left: box.left + box.width / 2, top: box.top + box.height / 2 }}>
      <Button variant="outline" size="xs" onClick={onReplay} className="shadow-sm">
        ดูคำแนะนำอีกครั้ง
      </Button>
    </div>
  )
}
