import { Button } from '@/components/ui/button'
import { formatClock } from './replay-format'
import type { Replay } from './use-replay'

const STATE_LABELS = {
  working: 'กำลังทำงาน',
  waiting: 'รอคำสั่ง',
  blocked: 'ติดขัด',
  done: 'เสร็จแล้ว'
} as const

function bannerText(replay: Replay): string {
  if (replay.status === 'loading') {
    return 'กำลังโหลดวันที่ย้อนดู'
  }
  if (replay.status === 'error') {
    return 'โหลดวันที่ย้อนดูไม่ได้'
  }
  return `ย้อนดู ${formatClock(replay.at)}`
}

export function ReplayBanner({ replay }: { replay: Replay }): React.JSX.Element {
  return (
    <div
      role="status"
      className="absolute top-3 left-1/2 z-overlay flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-card/95 py-1.5 pr-1.5 pl-3 shadow-md backdrop-blur-md"
    >
      <span className="text-body-strong">{bannerText(replay)}</span>
      {replay.date ? <span className="font-mono text-caption text-muted-foreground">{replay.date}</span> : null}
      <Button type="button" size="xs" variant="outline" onClick={replay.leave}>
        กลับปัจจุบัน
      </Button>
    </div>
  )
}

export function ReplayCard({ replay }: { replay: Replay }): React.JSX.Element | null {
  const agent = replay.picked
  if (agent === null) {
    return null
  }
  return (
    <aside aria-label="เอเจนต์ ณ ขณะนั้น" className="absolute top-16 right-3 z-overlay flex w-64 flex-col gap-1 rounded-lg border bg-card p-3 shadow-md">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-body-strong break-words">{agent.title}</h2>
        <Button type="button" size="xs" variant="ghost" onClick={() => replay.pick(null)} aria-label="ปิดการ์ด">
          ปิด
        </Button>
      </div>
      <dl className="flex flex-col gap-0.5 text-small">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">repo</dt>
          <dd className="break-words">{agent.repo ?? '-'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">สถานะ ณ {formatClock(replay.at)}</dt>
          <dd>{STATE_LABELS[agent.state]}</dd>
        </div>
      </dl>
      <p className="text-caption text-muted-foreground">ดูได้อย่างเดียว ส่งคำสั่งไม่ได้ระหว่างย้อนดู</p>
    </aside>
  )
}
