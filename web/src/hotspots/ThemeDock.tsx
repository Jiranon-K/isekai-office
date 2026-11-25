import { AlertsOffIcon, AlertsOnIcon, MoonIcon, SunIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { type Theme, toggleMode, WORLD_LABELS, WORLDS } from '@/lib/theme'
import type { AlertSetting } from '@/notify/use-alert-setting'
import { WORLD_ICONS } from './WorldPanel'

type ThemeDockProps = { theme: Theme; onThemeChange(theme: Theme): void; alerts: AlertSetting }

const ALERTS_LABEL = 'แจ้งเตือนเมื่อ agent รอคุณ'
const ALERTS_DENIED = 'เบราว์เซอร์ไม่อนุญาตการแจ้งเตือน'

function AlertsButton({ alerts }: { alerts: AlertSetting }): React.JSX.Element | null {
  if (!alerts.supported) {
    return null
  }
  const hint = alerts.denied ? ALERTS_DENIED : ALERTS_LABEL
  return (
    <>
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      <Button
        variant={alerts.enabled ? 'default' : 'ghost'}
        size="icon-sm"
        aria-pressed={alerts.enabled}
        aria-label={ALERTS_LABEL}
        aria-description={alerts.denied ? ALERTS_DENIED : undefined}
        title={hint}
        onClick={alerts.toggle}
      >
        {alerts.enabled ? <AlertsOnIcon /> : <AlertsOffIcon />}
      </Button>
    </>
  )
}

export function ThemeDock({ theme, onThemeChange, alerts }: ThemeDockProps): React.JSX.Element {
  const isNight = theme.mode === 'night'
  const modeLabel = isNight ? 'กลางคืน กดเพื่อสลับเป็นกลางวัน' : 'กลางวัน กดเพื่อสลับเป็นกลางคืน'
  return (
    <div
      role="toolbar"
      aria-label="เปลี่ยนโลก สลับกลางวันกลางคืน และการแจ้งเตือน"
      className="absolute bottom-3 left-3 z-overlay flex items-center gap-1 rounded-lg border bg-card/90 p-1 shadow-md backdrop-blur-md"
    >
      {WORLDS.map((world) => {
        const Icon = WORLD_ICONS[world]
        return (
          <Button
            key={world}
            variant={theme.world === world ? 'default' : 'ghost'}
            size="icon-sm"
            aria-pressed={theme.world === world}
            aria-label={WORLD_LABELS[world]}
            title={WORLD_LABELS[world]}
            onClick={() => onThemeChange({ ...theme, world })}
          >
            <Icon />
          </Button>
        )
      })}
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      <Button variant="ghost" size="sm" aria-pressed={isNight} aria-label={modeLabel} title={modeLabel} onClick={() => onThemeChange(toggleMode(theme))}>
        {isNight ? <MoonIcon /> : <SunIcon />}
        {isNight ? 'กลางคืน' : 'กลางวัน'}
      </Button>
      <AlertsButton alerts={alerts} />
    </div>
  )
}
