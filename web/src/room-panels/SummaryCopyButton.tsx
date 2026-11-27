import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toMarkdown } from './summary-markdown'
import type { DaySummary } from './summary-logic'

export function SummaryCopyButton({ summary }: { summary: DaySummary }): React.JSX.Element {
  const [label, setLabel] = useState('คัดลอกเป็น Markdown')
  const copy = (): void => {
    navigator.clipboard
      .writeText(toMarkdown(summary))
      .then(() => setLabel('คัดลอกแล้ว'))
      .catch(() => setLabel('คัดลอกไม่ได้'))
  }
  return (
    <Button type="button" variant="outline" onClick={copy}>
      {label}
    </Button>
  )
}
