import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type PanelTab = 'chat' | 'files' | 'orders'

function parseTab(value: string): PanelTab {
  if (value === 'files' || value === 'orders') {
    return value
  }
  return 'chat'
}

export function PanelTabs({ tab, onChange }: { tab: PanelTab; onChange(tab: PanelTab): void }): React.JSX.Element {
  return (
    <Tabs value={tab} onValueChange={(value) => onChange(parseTab(value))} className="border-b px-3 py-2">
      <TabsList className="w-full">
        <TabsTrigger value="chat">แชท</TabsTrigger>
        <TabsTrigger value="files">ไฟล์ที่แก้</TabsTrigger>
        <TabsTrigger value="orders">คำสั่งประจำ</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
