import type { OfficeSnapshot } from '@shared/types'
import { OfflineIcon } from '@/components/icons'
import type { Loadable } from '@/lib/api'

type StatusChipProps = { office: Loadable<OfficeSnapshot>; onOpen(): void }

export function systemTrouble(office: Loadable<OfficeSnapshot>): string | null {
  if (office.error === 'server_unreachable') {
    return 'ติดต่อ server ไม่ได้'
  }
  return office.data !== null && !office.data.sourceReady ? 'Orca ปิดอยู่' : null
}

export function StatusChip({ office, onOpen }: StatusChipProps): React.JSX.Element | null {
  const trouble = systemTrouble(office)
  if (!trouble) {
    return null
  }
  return (
    <div role="status" className="absolute top-3 left-3 z-overlay">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${trouble} เปิดสถานะระบบที่เตาผิง`}
        className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-md bg-tint-red-bg px-2.5 text-caption text-tint-red-fg shadow-md"
      >
        <OfflineIcon />
        {trouble}
      </button>
    </div>
  )
}
