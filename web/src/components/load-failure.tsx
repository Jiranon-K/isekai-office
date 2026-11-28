import { useId, useLayoutEffect, useRef } from 'react'
import { useEscapeLayer } from '@/components/escape-layer'
import { AlertIcon, RefreshIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'

export type LoadFailureProps = {
  title: string
  closeLabel?: string
  extra?: React.ReactNode
  onClose(): void
}

function isTopCard(card: HTMLElement | null): boolean {
  const cards = document.querySelectorAll('[data-load-failure]')
  return cards[cards.length - 1] === card
}

function useBorrowedFocus(card: React.RefObject<HTMLElement | null>, target: React.RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const previous = document.activeElement
    const shownCard = card.current
    target.current?.focus()
    return () => {
      const stillHeld = shownCard?.contains(document.activeElement)
      if (stillHeld && previous instanceof HTMLElement && previous.isConnected) {
        previous.focus()
      }
    }
  }, [card, target])
}

export function LoadFailure({ title, closeLabel = 'ปิด', extra, onClose }: LoadFailureProps): React.JSX.Element {
  const titleId = useId()
  const detailId = useId()
  const card = useRef<HTMLDivElement>(null)
  const reload = useRef<HTMLButtonElement>(null)
  useBorrowedFocus(card, reload)
  useEscapeLayer(onClose, () => isTopCard(card.current))
  return (
    <div className="pointer-events-none absolute inset-0 z-toast flex items-center justify-center p-3">
      <div
        ref={card}
        data-load-failure=""
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={detailId}
        className="pointer-events-auto flex w-80 max-w-full flex-col items-start gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg"
      >
        <h2 id={titleId} className="flex items-center gap-2 text-body-strong">
          <AlertIcon className="text-destructive" />
          {title}
        </h2>
        <div id={detailId} className="text-body">
          <p>เช็กว่า server ยังรันอยู่ แล้วโหลดหน้าใหม่</p>
          {extra}
        </div>
        <div className="flex gap-2">
          <Button ref={reload} size="sm" onClick={() => location.reload()}>
            <RefreshIcon />
            โหลดหน้าใหม่
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            {closeLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
