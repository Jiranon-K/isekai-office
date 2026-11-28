import type { OfficeSnapshot } from '@shared/types'

export type SourceHealth = { label: string; ok: boolean }

const SOURCE_NAMES: Record<OfficeSnapshot['source'], string> = {
  orca: 'Orca',
  local: 'Claude Code (อ่านไฟล์)'
}

export function sourceHealth(snapshot: OfficeSnapshot | null): SourceHealth {
  if (!snapshot) {
    return { label: 'ยังไม่ทราบ', ok: false }
  }
  const name = SOURCE_NAMES[snapshot.source]
  return snapshot.sourceReady ? { label: name, ok: true } : { label: `${name} (ปิดอยู่)`, ok: false }
}

export function managedStatus(snapshot: OfficeSnapshot | null): string | null {
  if (!snapshot || snapshot.managedCap === undefined) {
    return null
  }
  return `คุมโดยห้อง ${snapshot.managedCount ?? 0}/${snapshot.managedCap}`
}
