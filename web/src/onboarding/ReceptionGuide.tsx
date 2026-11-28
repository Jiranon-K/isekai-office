import type { OfficeAgent } from '@shared/types'
import type { RefObject } from 'react'
import { useSourceCaps } from '@/lib/source-caps'
import type { AgentLocator } from '@/office/use-office-canvas'
import { ReceptionReplay } from './ReceptionReplay'
import { ReceptionTour } from './ReceptionTour'
import { tourStep } from './tour-logic'
import { useTour } from './use-tour'

type ReceptionGuideProps = {
  agents: readonly OfficeAgent[]
  locateRef: RefObject<AgentLocator | null>
  hidden: boolean
}

export function ReceptionGuide({ agents, locateRef, hidden }: ReceptionGuideProps): React.JSX.Element | null {
  const tour = useTour()
  const caps = useSourceCaps()
  if (hidden) {
    return null
  }
  const view = tour.step === null ? null : tourStep(tour.step, { agents, readOnly: !caps.command })
  return (
    <>
      {view ? <ReceptionTour view={view} locateRef={locateRef} onNext={tour.next} onSkip={tour.skip} /> : null}
      <ReceptionReplay visible={view === null} onReplay={tour.restart} />
    </>
  )
}
