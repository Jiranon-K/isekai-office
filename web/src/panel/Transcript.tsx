import type { SessionDetail, SessionEntry } from '@shared/types'
import { Fragment, useEffect, useRef, useState } from 'react'
import { AlertIcon, RefreshIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Loadable } from '@/lib/api'
import { dayLabel, isNearEnd, startsNewDay, visibleStart } from './panel-logic'
import { DayDivider, TranscriptEntry } from './TranscriptEntry'

type TranscriptProps = Loadable<SessionDetail> & { retry(): void }

const PAGE_SIZE = 40

function TranscriptSkeleton(): React.JSX.Element {
  return (
    <div role="status" aria-label="กำลังโหลดบทสนทนา" className="flex flex-col gap-3">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}

function latestKey(entries: SessionEntry[]): string {
  const last = entries.at(-1)
  return last ? `${entries.length}:${last.at}:${last.text.length}:${last.tools.length}` : ''
}

function useStickToEnd(endRef: React.RefObject<HTMLLIElement | null>, latest: string): void {
  const pinned = useRef(true)
  const ready = latest !== ''

  useEffect(() => {
    const scroller = endRef.current?.closest('[data-transcript-scroller]')
    if (!scroller) {
      return
    }
    const track = (): void => {
      pinned.current = isNearEnd(scroller.scrollTop, scroller.clientHeight, scroller.scrollHeight)
    }
    scroller.addEventListener('scroll', track, { passive: true })
    return () => scroller.removeEventListener('scroll', track)
  }, [endRef, ready])

  useEffect(() => {
    if (pinned.current) {
      endRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [endRef, latest])
}

function EntryList({ entries }: { entries: SessionEntry[] }): React.JSX.Element {
  const endRef = useRef<HTMLLIElement>(null)
  const [shown, setShown] = useState(PAGE_SIZE)
  const start = visibleStart(entries.length, shown)
  useStickToEnd(endRef, latestKey(entries))
  return (
    <ul aria-label="ประวัติแชท" className="flex flex-col gap-2">
      {start > 0 ? (
        <li className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setShown((current) => current + PAGE_SIZE)}>
            ดูข้อความก่อนหน้า ({start})
          </Button>
        </li>
      ) : null}
      {entries.slice(start).map((entry, offset) => {
        const index = start + offset
        const day = startsNewDay(entries[index - 1]?.at, entry.at) ? dayLabel(entry.at) : null
        return (
          <Fragment key={`${index}-${entry.role}`}>
            {day ? <DayDivider label={day} /> : null}
            <TranscriptEntry entry={entry} />
          </Fragment>
        )
      })}
      <li ref={endRef} aria-hidden="true" />
    </ul>
  )
}

export function Transcript({ data, error, loading, retry }: TranscriptProps): React.JSX.Element {
  const entryCount = data?.entries.length ?? 0

  if (!data && error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 rounded-md bg-tint-red-bg p-3 text-small text-tint-red-fg">
        <span className="flex items-center gap-1.5 text-body-strong">
          <AlertIcon />
          อ่านบทสนทนาไม่ได้
        </span>
        <p>ดึงข้อมูล session ไม่สำเร็จ ({error}) ลองใหม่อีกครั้ง</p>
        <Button variant="outline" size="sm" onClick={retry}>
          <RefreshIcon />
          ลองใหม่
        </Button>
      </div>
    )
  }
  if (!data || loading && entryCount === 0) {
    return <TranscriptSkeleton />
  }
  if (entryCount === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-small text-muted-foreground">
        ยังไม่มีข้อความใน session นี้ พิมพ์ prompt ด้านล่างเพื่อเริ่มคุย
      </p>
    )
  }
  return <EntryList entries={data.entries} />
}
