import { useEffect, useState } from 'react'
import { computeView, toScreenBox, type ScreenBox } from './office-view'

type RoomFrame = { left: number; top: number; width: number; height: number }

function measure(): RoomFrame {
  const canvas = document.querySelector('[data-room-canvas]')
  if (!canvas) {
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
  }
  const bounds = canvas.getBoundingClientRect()
  return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }
}

function useRoomFrame(): RoomFrame {
  const [frame, setFrame] = useState(measure)
  useEffect(() => {
    const update = (): void => setFrame(measure())
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [])
  return frame
}

export function useRoomBox(rect: { x: number; y: number; width: number; height: number }): ScreenBox {
  const frame = useRoomFrame()
  const box = toScreenBox(computeView(frame.width, frame.height, 1), rect)
  return { ...box, left: box.left + frame.left, top: box.top + frame.top }
}
