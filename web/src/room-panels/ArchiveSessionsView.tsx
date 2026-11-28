import { useCallback, useEffect, useRef, useState } from 'react'
import type { ArchivedSession } from '@shared/archive'
import { Badge } from '@/components/badge'
import { AlertIcon, RefreshIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchArchiveList } from './archive-api'
import { formatRelativeTime, mergeRepos } from './archive-logic'
import { ArchiveSessionDetail } from './ArchiveSessionDetail'
import { PanelNote } from './SessionList'

const DEBOUNCE_MS = 200
const FIELD_CLASS =
  'focus-ring h-8 rounded-md border border-input bg-popover px-2.5 text-small text-foreground placeholder:text-muted-foreground'

function ArchiveSkeleton(): React.JSX.Element {
  return (
    <div role="status" aria-label="กำลังโหลดเซสชันเก่า" className="flex flex-col gap-2">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  )
}

function SessionRow({
  session,
  now,
  onSelect
}: {
  session: ArchivedSession
  now: number
  onSelect(session: ArchivedSession): void
}): React.JSX.Element {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(session)}
        className="focus-ring flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left transition-colors duration-fast hover:bg-accent hover:text-accent-foreground motion-reduce:transition-none"
      >
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-small font-medium">{session.title}</span>
          {session.active ? <Badge variant="green">อยู่ในห้อง</Badge> : null}
        </span>
        <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
          {session.repo ? (
            <Badge variant="outline" className="h-4.5 px-1.5 font-mono">
              {session.repo}
            </Badge>
          ) : null}
          <span>{formatRelativeTime(session.modifiedAt, now)}</span>
        </span>
      </button>
    </li>
  )
}

export function ArchiveSessionsView(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [repo, setRepo] = useState('')
  const [knownRepos, setKnownRepos] = useState<string[]>([])
  const [sessions, setSessions] = useState<ArchivedSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<ArchivedSession | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    fetchArchiveList(debouncedQuery, repo)
      .then((response) => {
        if (requestIdRef.current !== requestId) {
          return
        }
        setSessions(response.sessions)
        setKnownRepos((previous) => mergeRepos(previous, response.sessions))
        setError(null)
        setLoading(false)
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) {
          return
        }
        setSessions([])
        setError('archive_unavailable')
        setLoading(false)
      })
    return () => {
      requestIdRef.current += 1
    }
  }, [debouncedQuery, repo, revision])

  const retry = useCallback(() => setRevision((count) => count + 1), [])

  if (selected !== null) {
    return <ArchiveSessionDetail key={selected.id} session={selected} onBack={() => setSelected(null)} />
  }

  const filtered = debouncedQuery.trim() !== '' || repo !== ''
  const now = Date.now()

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-1.5">
        <input
          type="search"
          aria-label="ค้นหาชื่อ session หรือ repo"
          placeholder="ค้นหาชื่อ session หรือ repo"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={`${FIELD_CLASS} min-w-0 flex-1`}
        />
        <select
          aria-label="กรองตาม repo"
          value={repo}
          onChange={(event) => setRepo(event.target.value)}
          className={`${FIELD_CLASS} max-w-28 shrink-0`}
        >
          <option value="">ทุก repo</option>
          {knownRepos.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      {error && !loading ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-md bg-tint-red-bg p-3 text-small text-tint-red-fg">
          <span className="flex items-center gap-1.5 text-body-strong">
            <AlertIcon />
            อ่านหอจดหมายเหตุไม่ได้
          </span>
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            <RefreshIcon />
            ลองใหม่
          </Button>
        </div>
      ) : loading && sessions.length === 0 ? (
        <ArchiveSkeleton />
      ) : sessions.length === 0 ? (
        <PanelNote>{filtered ? 'ไม่พบเซสชันที่ตรงกับเงื่อนไข' : 'ยังไม่มีเซสชันเก่าในเครื่อง'}</PanelNote>
      ) : (
        <ul aria-label="เซสชันเก่า" className="flex flex-col gap-1">
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} now={now} onSelect={setSelected} />
          ))}
        </ul>
      )}
    </div>
  )
}
