import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { copyText } from './summary-copy'
import { toMarkdown } from './summary-markdown'
import type { DaySummary } from './summary-logic'

const IDLE_LABEL = 'คัดลอกเป็น Markdown'
const DONE_LABEL = 'คัดลอกแล้ว'
const FAILED_LABEL = 'คัดลอกไม่ได้'
const RESET_AFTER_MS = 2000

export function SummaryCopyButton({ summary }: { summary: DaySummary }): React.JSX.Element {
  const [label, setLabel] = useState(IDLE_LABEL)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => clearTimeout(timer.current ?? undefined), [])
  const show = (next: string): void => {
    setLabel(next)
    clearTimeout(timer.current ?? undefined)
    timer.current = setTimeout(() => setLabel(IDLE_LABEL), RESET_AFTER_MS)
  }
  const copy = (): void => {
    copyText(toMarkdown(summary)).then(
      () => show(DONE_LABEL),
      () => show(FAILED_LABEL)
    )
  }
  return (
    <Button type="button" variant="outline" onClick={copy}>
      {label}
    </Button>
  )
}
