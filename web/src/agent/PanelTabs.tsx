import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type PanelTab = 'chat' | 'orders'

export function PanelTabs({ tab, onChange }: { tab: PanelTab; onChange(tab: PanelTab): void }): React.JSX.Element {
  return (
    <Tabs value={tab} onValueChange={(value) => onChange(value === 'orders' ? 'orders' : 'chat')} className="border-b px-3 py-2">
      <TabsList className="w-full">
        <TabsTrigger value="chat">แชท</TabsTrigger>
        <TabsTrigger value="orders">คำสั่งประจำ</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
