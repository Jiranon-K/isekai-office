import { useState, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import type { AgentLocator } from '@/office/use-office-canvas'
import type { TourStep } from './tour-logic'
import { useTargetAnchor } from './use-target-anchor'

type ReceptionTourProps = {
  view: TourStep
  locateRef: RefObject<AgentLocator | null>
  onNext(): void
  onSkip(): void
}

export function ReceptionTour({ view, locateRef, onNext, onSkip }: ReceptionTourProps): React.JSX.Element {
  const anchor = useTargetAnchor(view.target, locateRef)
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  return (
    <Popover open>
      <div ref={setViewport} aria-hidden="true" className="pointer-events-none fixed inset-0" />
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent
        side="bottom"
        sideOffset={10}
        collisionPadding={12}
        collisionBoundary={viewport}
        updatePositionStrategy="always"
        aria-label="คำแนะนำการใช้งาน"
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="flex w-72 flex-col gap-3 text-small"
      >
        <p>{view.body}</p>
        {view.note ? <p className="text-muted-foreground">{view.note}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            ข้าม
          </Button>
          <Button size="sm" onClick={onNext}>
            {view.last ? 'เสร็จ' : 'ถัดไป'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
