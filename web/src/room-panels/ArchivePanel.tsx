import type { BoardSnapshot } from '@shared/types'
import { Skeleton } from '@/components/ui/skeleton'
import type { Loadable } from '@/lib/api'
import { CardRows } from './CardRows'
import { loopHistory } from './panel-data'
import { PanelNote } from './SessionList'

export function ArchivePanel({ board }: { board: Loadable<BoardSnapshot> }): React.JSX.Element {
  if (!board.data) {
    return board.loading ? <Skeleton className="h-24 w-full" /> : <PanelNote>อ่าน board ไม่ได้ จึงยังไม่มีประวัติ Loop</PanelNote>
  }
  const history = loopHistory(board.data)
  if (history.length === 0) {
    return <PanelNote>ยังไม่มีงานที่ Loop รับไป</PanelNote>
  }
  return <CardRows cards={history} label="ประวัติงานใน Loop" />
}
