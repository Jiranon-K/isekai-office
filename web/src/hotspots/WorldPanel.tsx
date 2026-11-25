import { GroveIcon, KeepIcon, MeadowIcon, MoonIcon, SunIcon, TavernIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { type Theme, toggleMode, WORLD_LABELS, WORLDS, type World } from '@/lib/theme'

type WorldPanelProps = { theme: Theme; onThemeChange(theme: Theme): void }

export const WORLD_ICONS: Record<World, typeof TavernIcon> = {
  tavern: TavernIcon,
  grove: GroveIcon,
  keep: KeepIcon,
  meadow: MeadowIcon
}

export function WorldPanel({ theme, onThemeChange }: WorldPanelProps): React.JSX.Element {
  const isNight = theme.mode === 'night'
  return (
    <>
      <ul className="grid grid-cols-2 gap-2" aria-label="เลือกโลก">
        {WORLDS.map((world) => {
          const Icon = WORLD_ICONS[world]
          return (
            <li key={world}>
              <Button
                variant={theme.world === world ? 'default' : 'outline'}
                aria-pressed={theme.world === world}
                className="h-auto w-full flex-col gap-1 px-2 py-3 text-small whitespace-normal"
                onClick={() => onThemeChange({ ...theme, world })}
              >
                <Icon className="size-5" />
                {WORLD_LABELS[world]}
              </Button>
            </li>
          )
        })}
      </ul>
      <Button variant="outline" size="sm" aria-pressed={isNight} onClick={() => onThemeChange(toggleMode(theme))}>
        {isNight ? <MoonIcon /> : <SunIcon />}
        {isNight ? 'กลางคืน' : 'กลางวัน'}
        <span className="text-muted-foreground">(หน้าต่างก็สลับได้)</span>
      </Button>
    </>
  )
}
