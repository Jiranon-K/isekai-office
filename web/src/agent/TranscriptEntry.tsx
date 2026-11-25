import type { SessionEntry } from '@shared/types'
import { useState } from 'react'
import { Badge } from '@/components/badge'
import { cn } from '@/lib/utils'
import { formatTime, isLongText, toolCounts } from './panel-logic'

function ToolBadges({ tools }: { tools: string[] }): React.JSX.Element {
  return (
    <>
      {toolCounts(tools).map((tool) => (
        <Badge key={tool.name} variant="outline" className="font-mono">
          {tool.count > 1 ? `${tool.name} ×${tool.count}` : tool.name}
        </Badge>
      ))}
    </>
  )
}

function ToolLine({ tools }: { tools: string[] }): React.JSX.Element {
  return (
    <li className="flex flex-wrap items-center gap-1 px-1 text-caption text-muted-foreground">
      <span>ใช้</span>
      <ToolBadges tools={tools} />
    </li>
  )
}

function EntryText({ text }: { text: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const long = isLongText(text)
  return (
    <>
      <p className={cn('text-small wrap-anywhere whitespace-pre-wrap', long && !open && 'line-clamp-8')}>{text}</p>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="focus-ring self-start rounded-sm text-caption text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {open ? 'ย่อข้อความ' : 'อ่านทั้งหมด'}
        </button>
      ) : null}
    </>
  )
}

export function DayDivider({ label }: { label: string }): React.JSX.Element {
  return (
    <li className="flex items-center gap-2 text-caption text-muted-foreground">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      {label}
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </li>
  )
}

export function TranscriptEntry({ entry }: { entry: SessionEntry }): React.JSX.Element {
  const fromUser = entry.role === 'user'
  const time = formatTime(entry.at)
  if (!entry.text) {
    return <ToolLine tools={entry.tools} />
  }
  return (
    <li className={cn('flex flex-col gap-1 rounded-md border px-3 py-2', fromUser ? 'bg-muted' : 'bg-card')}>
      <span className="flex items-baseline justify-between gap-2 text-caption">
        {fromUser ? 'คุณ' : 'Claude'}
        {time ? <time className="font-normal text-muted-foreground tabular-nums">{time}</time> : null}
      </span>
      <EntryText text={entry.text} />
      {entry.tools.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          <ToolBadges tools={entry.tools} />
        </div>
      ) : null}
    </li>
  )
}
