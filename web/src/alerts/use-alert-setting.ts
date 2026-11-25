import { useCallback, useState } from 'react'
import { ALERTS_KEY, storedEnabled } from './alert-logic'

export type AlertSetting = { supported: boolean; enabled: boolean; denied: boolean; toggle(): void }

function isSupported(): boolean {
  return typeof Notification !== 'undefined'
}

function readEnabled(): boolean {
  return isSupported() && storedEnabled(localStorage.getItem(ALERTS_KEY), Notification.permission)
}

async function askPermission(): Promise<boolean> {
  return (await Notification.requestPermission()) === 'granted'
}

export function useAlertSetting(): AlertSetting {
  const [enabled, setEnabled] = useState(readEnabled)
  const [denied, setDenied] = useState(false)

  const switchOn = useCallback(async () => {
    const allowed = await askPermission()
    setDenied(!allowed)
    if (!allowed) {
      return
    }
    localStorage.setItem(ALERTS_KEY, '1')
    setEnabled(true)
  }, [])

  const toggle = useCallback(() => {
    if (enabled) {
      localStorage.removeItem(ALERTS_KEY)
      setEnabled(false)
      return
    }
    void switchOn()
  }, [enabled, switchOn])

  return { supported: isSupported(), enabled, denied, toggle }
}
