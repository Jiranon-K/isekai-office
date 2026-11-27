import type { OfficeSnapshot } from '@shared/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Loadable } from '@/lib/api'
import { HearthStatus } from './HearthPanel'
import { SummaryPanel } from './SummaryPanel'

type HearthTabsProps = { office: Loadable<OfficeSnapshot>; onSelect(agentId: string): void }

export function HearthTabs({ office, onSelect }: HearthTabsProps): React.JSX.Element {
  const present = new Set((office.data?.agents ?? []).map((agent) => agent.id))
  return (
    <Tabs defaultValue="status" className="gap-3">
      <TabsList aria-label="ชั้นเตาผิง" className="w-full">
        <TabsTrigger value="status">สถานะ</TabsTrigger>
        <TabsTrigger value="summary">สรุปวัน</TabsTrigger>
      </TabsList>
      <TabsContent value="status" className="flex flex-col gap-3">
        <HearthStatus office={office} onSelect={onSelect} />
      </TabsContent>
      <TabsContent value="summary">
        <SummaryPanel present={present} onSelect={onSelect} />
      </TabsContent>
    </Tabs>
  )
}
