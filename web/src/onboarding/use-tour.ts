import { useCallback, useState } from 'react'
import { readTourDone, TOUR_STEP_COUNT, writeTourDone, type TourStorage } from './tour-logic'

export type TourControls = { step: number | null; next(): void; skip(): void; restart(): void }

function browserStorage(): TourStorage {
  return window.localStorage
}

export function useTour(): TourControls {
  const [step, setStep] = useState<number | null>(() => (readTourDone(browserStorage) ? null : 0))
  const finish = useCallback(() => {
    writeTourDone(browserStorage)
    setStep(null)
  }, [])
  const next = useCallback(() => {
    if (step === null) {
      return
    }
    if (step + 1 >= TOUR_STEP_COUNT) {
      finish()
      return
    }
    setStep(step + 1)
  }, [step, finish])
  const restart = useCallback(() => setStep(0), [])
  return { step, next, skip: finish, restart }
}
