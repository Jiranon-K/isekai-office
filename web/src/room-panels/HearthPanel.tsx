import type { OfficeSnapshot } from '@shared/types'
import { Badge } from '@/components/badge'
import { useGuildLog, type Loadable } from '@/lib/api'
import { ReplayEntry } from '@/replay/ReplayEntry'
import { GuildLogSection } from './GuildLogSection'
import { managedStatus, sourceHealth } from './source-health'
import { useLastHidden } from './use-last-hidden'

type Health = { label: string; ok: boolean }

function serverHealth(office: Loadable<OfficeSnapshot>): Health {
  if (office.error === 'server_unreachable') {
    return { label: 'ติดต่อไม่ได้', ok: false }
  }
  return office.data ? { label: 'เชื่อมต่ออยู่', ok: true } : { label: 'กำลังเชื่อมต่อ', ok: false }
}

function HealthRow({ name, health }: { name: string; health: Health }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-small">{name}</dt>
      <dd>
        <Badge variant={health.ok ? 'green' : 'red'}>{health.label}</Badge>
      </dd>
    </div>
  )
}

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function HearthStatus({ office, onSelect }: { office: Loadable<OfficeSnapshot>; onSelect(agentId: string): void }): React.JSX.Element {
  const log = useGuildLog(true, office.data?.at ?? 0)
  const lastHidden = useLastHidden()
  const present = new Set((office.data?.agents ?? []).map((agent) => agent.id))
  const managed = managedStatus(office.data)
  return (
    <>
      <dl className="flex flex-col gap-2">
        <HealthRow name="Server" health={serverHealth(office)} />
        <HealthRow name="แหล่งข้อมูล" health={sourceHealth(office.data)} />
        {managed ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-small">เซสชันในห้อง</dt>
            <dd>
              <Badge variant="outline" className="font-mono">
                {managed}
              </Badge>
            </dd>
          </div>
        ) : null}
      </dl>
      {office.data?.error ? (
        <p role="alert" className="rounded-md bg-tint-red-bg p-2 font-mono text-caption break-words text-tint-red-fg">
          {office.data.error}
        </p>
      ) : null}
      {office.data && office.data.at > 0 ? (
        <p className="text-caption text-muted-foreground">
          ข้อมูลล่าสุด {formatTime(office.data.at)} · {office.data.agents.length} session
        </p>
      ) : null}
      <ReplayEntry />
      <GuildLogSection log={log} lastHidden={lastHidden} present={present} onSelect={onSelect} />
    </>
  )
}
