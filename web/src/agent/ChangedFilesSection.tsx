import { useCallback, useEffect, useState } from 'react'
import type { AgentDiff, ChangedFile } from '@shared/diff'
import { Badge } from '@/components/badge'
import { AlertIcon, RefreshIcon } from '@/components/icons'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchAgentDiff } from '@/lib/api'
import { classifyDiffState, STATUS_CODE, STATUS_VARIANT } from './diff-logic'

function Pane({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">{children}</div>
}

function DiffSkeleton(): React.JSX.Element {
  return (
    <Pane>
      <div role="status" aria-label="กำลังโหลดรายการไฟล์ที่แก้" className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Spinner />
          <Skeleton className="h-5 w-28" />
        </div>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    </Pane>
  )
}

function FileRow({ file }: { file: ChangedFile }): React.JSX.Element {
  return (
    <li className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5">
      <Badge variant={STATUS_VARIANT[file.status]} className="w-6 shrink-0 justify-center px-0 font-mono">
        {STATUS_CODE[file.status]}
      </Badge>
      <code className="min-w-0 flex-1 truncate text-caption" title={file.path}>
        {file.path}
      </code>
      <span className="flex shrink-0 items-center gap-1 font-mono text-caption tabular-nums">
        <span className="text-tint-green-fg">+{file.added}</span>
        <span className="text-tint-red-fg">-{file.removed}</span>
      </span>
    </li>
  )
}

function DiffHeader({
  branch,
  fileCount,
  totalAdded,
  totalRemoved,
  loading,
  onRefresh
}: {
  branch: string | null
  fileCount: number
  totalAdded: number
  totalRemoved: number
  loading: boolean
  onRefresh(): void
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {branch ? (
          <Badge variant="outline" className="font-mono">
            {branch}
          </Badge>
        ) : null}
        <span className="text-caption text-muted-foreground">{fileCount} ไฟล์</span>
        <span className="flex items-center gap-1 font-mono text-caption tabular-nums">
          <span className="text-tint-green-fg">+{totalAdded}</span>
          <span className="text-tint-red-fg">-{totalRemoved}</span>
        </span>
      </div>
      <Button type="button" variant="ghost" size="xs" disabled={loading} onClick={onRefresh}>
        <RefreshIcon className="size-3.5" />
        รีเฟรช
      </Button>
    </div>
  )
}

export function ChangedFilesSection({ agentId }: { agentId: string }): React.JSX.Element {
  const [data, setData] = useState<AgentDiff | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)

  const refresh = useCallback(() => setRevision((count) => count + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetchAgentDiff(agentId)
      .then((diff) => {
        if (!active) {
          return
        }
        setData(diff)
        setLoading(false)
      })
      .catch(() => {
        if (!active) {
          return
        }
        setData(null)
        setError('diff_unavailable')
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [agentId, revision])

  const view = classifyDiffState(data, loading, error)

  if (view.kind === 'loading') {
    return <DiffSkeleton />
  }
  if (view.kind === 'no_worktree') {
    return (
      <Pane>
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-small text-muted-foreground">
          session นี้ไม่มี worktree ให้ตรวจไฟล์
        </p>
      </Pane>
    )
  }
  if (view.kind === 'error') {
    return (
      <Pane>
        <div role="alert" className="flex flex-col items-start gap-2 rounded-md bg-tint-red-bg p-3 text-small text-tint-red-fg">
          <span className="flex items-center gap-1.5 text-body-strong">
            <AlertIcon />
            อ่านสถานะ git ไม่ได้
          </span>
          <Button type="button" variant="outline" size="sm" onClick={refresh}>
            <RefreshIcon />
            ลองใหม่
          </Button>
        </div>
      </Pane>
    )
  }
  if (view.kind === 'empty') {
    return (
      <Pane>
        <DiffHeader branch={view.branch} fileCount={0} totalAdded={0} totalRemoved={0} loading={loading} onRefresh={refresh} />
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-small text-muted-foreground">
          ยังไม่มีไฟล์ที่แก้ใน worktree นี้
        </p>
      </Pane>
    )
  }

  return (
    <Pane>
      <DiffHeader
        branch={view.diff.branch}
        fileCount={view.diff.files.length}
        totalAdded={view.diff.totalAdded}
        totalRemoved={view.diff.totalRemoved}
        loading={loading}
        onRefresh={refresh}
      />
      <ul aria-label="ไฟล์ที่แก้" className="flex flex-col gap-1">
        {view.diff.files.map((file) => (
          <FileRow key={`${file.status}:${file.path}`} file={file} />
        ))}
      </ul>
      {view.diff.truncated ? (
        <p role="note" className="text-caption text-muted-foreground">
          แสดง 100 ไฟล์แรกเท่านั้น
        </p>
      ) : null}
    </Pane>
  )
}
