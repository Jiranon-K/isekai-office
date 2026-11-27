import { useEffect, useState } from 'react'
import { Kbd } from '@/components/kbd'
import { isRevealKey, isTyping } from '@/lib/keyboard'

const HINTS = [
  { keys: 'n', label: 'ไปหาคนที่รอ' },
  { keys: 'a', label: 'ตอบทีละคน' },
  { keys: '1-9', label: 'ตอบ' }
]

function useRevealHeld(): boolean {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    const show = (event: KeyboardEvent): void => {
      if (isRevealKey(event) && !isTyping(event.target)) {
        setHeld(true)
      }
    }
    const hide = (): void => setHeld(false)
    window.addEventListener('keydown', show)
    window.addEventListener('keyup', hide)
    window.addEventListener('blur', hide)
    return () => {
      window.removeEventListener('keydown', show)
      window.removeEventListener('keyup', hide)
      window.removeEventListener('blur', hide)
    }
  }, [])
  return held
}

export function KeyHints(): React.JSX.Element | null {
  const held = useRevealHeld()
  if (!held) {
    return null
  }
  return (
    <ul
      aria-label="ปุ่มลัด"
      className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-4 rounded-md border border-border bg-popover px-3 py-2 text-small text-popover-foreground shadow-md"
    >
      {HINTS.map((hint) => (
        <li key={hint.keys} className="flex items-center gap-2">
          <Kbd>{hint.keys}</Kbd>
          {hint.label}
        </li>
      ))}
    </ul>
  )
}
