import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Theme } from '@/lib/theme'
import { SpawnForm } from './SpawnForm'
import { TemplatesPanel } from './TemplatesPanel'
import { WorldPanel } from './WorldPanel'

type DoorPanelProps = { theme: Theme; onThemeChange(theme: Theme): void }

export function DoorPanel({ theme, onThemeChange }: DoorPanelProps): React.JSX.Element {
  return (
    <Tabs defaultValue="spawn" className="gap-3">
      <TabsList aria-label="ประตู" className="w-full">
        <TabsTrigger value="spawn">เรียกคนใหม่</TabsTrigger>
        <TabsTrigger value="worlds">เลือกโลก</TabsTrigger>
        <TabsTrigger value="templates">แม่แบบ</TabsTrigger>
      </TabsList>
      <TabsContent value="spawn">
        <SpawnForm />
      </TabsContent>
      <TabsContent value="worlds" className="flex flex-col gap-3">
        <WorldPanel theme={theme} onThemeChange={onThemeChange} />
      </TabsContent>
      <TabsContent value="templates">
        <TemplatesPanel />
      </TabsContent>
    </Tabs>
  )
}
