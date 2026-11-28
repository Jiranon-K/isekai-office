import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ArchivedSession } from '@shared/archive'
import type { SessionDetail } from '@shared/types'
import { Transcript } from '@/agent/Transcript'
import { Badge } from '@/components/badge'
import { AlertIcon, RefreshIcon } from '@/components/icons'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { fetchTemplates, saveTemplates } from '@/lib/templates-api'
import { fetchArchivedSession } from './archive-api'
import { firstUserPrompt, formatRelativeTime, saveSessionAsTemplate } from './archive-logic'

type ArchiveSessionDetailProps = {
  session: ArchivedSession
  onBack(): void
}

type CopyState = 'idle' | 'copied' | 'failed'
type TemplateState = 'idle' | 'saving' | 'saved' | 'limit_reached' | 'failed'

const COPY_RESET_MS = 2_000

function templateButtonLabel(state: TemplateState): string {
  if (state === 'saved') {
    return 'บันทึกแม่แบบแล้ว'
  }
  if (state === 'limit_reached') {
    return 'แม่แบบเต็มแล้ว'
  }
  return 'บันทึกเป็นแม่แบบ'
}

export function ArchiveSessionDetail({ session, onBack }: ArchiveSessionDetailProps): React.JSX.Element {
  const [data, setData] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [templateState, setTemplateState] = useState<TemplateState>('idle')
  const requestIdRef = useRef(0)
  const copyIdRef = useRef(0)
  const saveIdRef = useRef(0)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCopyTimer = useCallback(() => {
    if (copyTimerRef.current !== null) {
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      requestIdRef.current += 1
      copyIdRef.current += 1
      saveIdRef.current += 1
      clearCopyTimer()
    }
  }, [clearCopyTimer])

  useEffect(() => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    fetchArchivedSession(session.id)
      .then((detail) => {
        if (requestIdRef.current !== requestId) {
          return
        }
        setData(detail)
        setError(null)
        setLoading(false)
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) {
          return
        }
        setData(null)
        setError('archive_session_unavailable')
        setLoading(false)
      })
  }, [session.id, revision])

  const retry = useCallback(() => setRevision((count) => count + 1), [])
  const prompt = useMemo(() => (data ? firstUserPrompt(data.entries) : null), [data])

  async function handleCopy(): Promise<void> {
    if (!prompt) {
      return
    }
    const copyId = ++copyIdRef.current
    clearCopyTimer()
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setCopyState('failed')
      return
    }
    try {
      await navigator.clipboard.writeText(prompt)
      if (copyIdRef.current !== copyId) {
        return
      }
      setCopyState('copied')
      copyTimerRef.current = setTimeout(() => {
        if (copyIdRef.current === copyId) {
          setCopyState('idle')
        }
      }, COPY_RESET_MS)
    } catch {
      if (copyIdRef.current === copyId) {
        setCopyState('failed')
      }
    }
  }

  async function handleSaveTemplate(): Promise<void> {
    if (!prompt || templateState === 'saving') {
      return
    }
    const saveId = ++saveIdRef.current
    setTemplateState('saving')
    const outcome = await saveSessionAsTemplate(session, prompt, fetchTemplates, saveTemplates)
    if (saveIdRef.current !== saveId) {
      return
    }
    if (outcome.kind === 'saved') {
      setTemplateState('saved')
      return
    }
    if (outcome.kind === 'limit_reached') {
      setTemplateState('limit_reached')
      return
    }
    setTemplateState('failed')
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start gap-2">
        <Button type="button" variant="outline" size="xs" onClick={onBack}>
          กลับ
        </Button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="truncate text-small font-medium" title={session.title}>
            {session.title}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
            {session.repo ? (
              <Badge variant="outline" className="h-4.5 px-1.5 font-mono">
                {session.repo}
              </Badge>
            ) : null}
            <span>{formatRelativeTime(session.modifiedAt, Date.now())}</span>
          </div>
        </div>
      </div>
      {prompt ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="outline" size="xs" onClick={() => void handleCopy()}>
            {copyState === 'copied' ? 'คัดลอกแล้ว' : 'คัดลอกคำสั่งแรก'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={templateState === 'saving' || templateState === 'saved' || templateState === 'limit_reached'}
            onClick={() => void handleSaveTemplate()}
          >
            {templateState === 'saving' ? <Spinner className="size-3" /> : templateButtonLabel(templateState)}
          </Button>
          {copyState === 'failed' ? (
            <span role="alert" className="text-caption text-tint-red-fg">
              คัดลอกไม่สำเร็จ
            </span>
          ) : null}
          {templateState === 'failed' ? (
            <span role="alert" className="text-caption text-tint-red-fg">
              บันทึกแม่แบบไม่ได้
            </span>
          ) : null}
        </div>
      ) : null}
      {error && !loading ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-md bg-tint-red-bg p-3 text-small text-tint-red-fg">
          <span className="flex items-center gap-1.5 text-body-strong">
            <AlertIcon />
            อ่านประวัติแชทไม่ได้
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onBack}>
              กลับ
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              <RefreshIcon />
              ลองใหม่
            </Button>
          </div>
        </div>
      ) : (
        <div data-transcript-scroller="" className="max-h-80 overflow-y-auto pr-0.5">
          <Transcript data={data} error={null} loading={loading} retry={retry} />
        </div>
      )}
    </div>
  )
}
