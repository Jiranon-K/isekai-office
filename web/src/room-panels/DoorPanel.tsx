import { useEffect, useState } from 'react'
import type { HandoffDraft } from '@shared/handoff'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Theme } from '@/lib/theme'
import { SpawnForm } from './SpawnForm'
import { TemplatesPanel } from './TemplatesPanel'
import { WorldPanel } from './WorldPanel'

type DoorPanelProps = {
  theme: Theme
  onThemeChange(theme: Theme): void
  handoffDraft: HandoffDraft | null
  onClearHandoff(): void
}

export function DoorPanel({ theme, onThemeChange, handoffDraft, onClearHandoff }: DoorPanelProps): React.JSX.Element {
  const [tab, setTab] = useState('spawn')

  useEffect(() => {
    if (handoffDraft !== null) {
      setTab('spawn')
    }
  }, [handoffDraft])

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-3">
      <TabsList aria-label="ประตู" className="w-full">
        <TabsTrigger value="spawn">เรียกคนใหม่</TabsTrigger>
        <TabsTrigger value="worlds">เลือกโลก</TabsTrigger>
        <TabsTrigger value="templates">แม่แบบ</TabsTrigger>
      </TabsList>
      <TabsContent value="spawn">
        <SpawnForm handoffDraft={handoffDraft} onClearHandoff={onClearHandoff} />
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
