import { useState } from 'react'
import { Popover, PopoverAnchor, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { hotspotBounds, type Hotspot } from '@/office/office-hotspots'
import { useRoomBox } from '@/office/use-room-view'

export type PanelSide = 'top' | 'right' | 'bottom' | 'left'

type HotspotPopoverProps = {
  hotspot: Hotspot
  side: PanelSide
  onClose(): void
  children: React.ReactNode
  className?: string
}

function refocus(opener: Element | null): void {
  if (opener instanceof HTMLElement && opener.isConnected) {
    opener.focus()
  }
}

export function HotspotPopover({ hotspot, side, onClose, children, className }: HotspotPopoverProps): React.JSX.Element {
  const box = useRoomBox(hotspotBounds(hotspot))
  const [opener] = useState(() => document.activeElement)
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <PopoverAnchor asChild>
        <div aria-hidden="true" className="pointer-events-none absolute" style={box} />
      </PopoverAnchor>
      <PopoverContent
        side={side}
        sideOffset={8}
        collisionPadding={12}
        updatePositionStrategy="always"
        aria-label={hotspot.label}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          refocus(opener)
        }}
        className={cn('flex max-h-(--radix-popover-content-available-height) w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-3 overflow-y-auto', className)}
      >
        <PopoverHeader>
          <PopoverTitle className="text-body-strong">{hotspot.label}</PopoverTitle>
          <PopoverDescription>{hotspot.hint}</PopoverDescription>
        </PopoverHeader>
        {children}
      </PopoverContent>
    </Popover>
  )
}
