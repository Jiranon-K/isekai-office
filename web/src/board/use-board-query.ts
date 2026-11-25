import { useCallback, useState } from 'react'
import { boardQueryParams, parseBoardQuery, type BoardQuery } from './view-logic'

const OWN_KEYS = ['tab', 'space', 'sprint', 'q']

function writeQuery(query: BoardQuery): void {
  const params = new URLSearchParams(location.search)
  OWN_KEYS.forEach((key) => params.delete(key))
  Object.entries(boardQueryParams(query)).forEach(([key, value]) => params.set(key, value))
  const search = params.toString()
  history.replaceState(null, '', search ? `?${search}` : location.pathname)
}

export function useBoardQuery(): [BoardQuery, (next: BoardQuery) => void] {
  const [query, setQueryState] = useState(() => parseBoardQuery(location.search))
  const setQuery = useCallback((next: BoardQuery) => {
    writeQuery(next)
    setQueryState(next)
  }, [])
  return [query, setQuery]
}
