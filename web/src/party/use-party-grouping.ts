import { useCallback, useState } from 'react'
import { GROUPING_KEY, parseGrouping, serializeGrouping } from './grouping-logic'

export function usePartyGrouping(): [boolean, (grouped: boolean) => void] {
  const [grouped, setGrouped] = useState(() => parseGrouping(localStorage.getItem(GROUPING_KEY)))
  const update = useCallback((next: boolean) => {
    localStorage.setItem(GROUPING_KEY, serializeGrouping(next))
    setGrouped(next)
  }, [])
  return [grouped, update]
}
