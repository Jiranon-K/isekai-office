import { useEffect, useState } from 'react'
import type { LogDays } from '@shared/day-log'

const WATCH_NOTE = 'บันทึกเฉพาะตอนมีแท็บเปิดอยู่ (ถ้าเปลี่ยนตอนไม่มีแท็บ จะลงเวลาที่แท็บเชื่อมต่อ)'

export function logNote(location: Pick<LogDays, 'directory' | 'keepDays'> | null): string {
  if (!location || location.directory === '') {
    return WATCH_NOTE
  }
  return `${WATCH_NOTE} บันทึกเก็บไว้ที่ ${location.directory} เป็นเวลา ${location.keepDays} วัน`
}

export function useLogLocation(): Pick<LogDays, 'directory' | 'keepDays'> | null {
  const [location, setLocation] = useState<Pick<LogDays, 'directory' | 'keepDays'> | null>(null)
  useEffect(() => {
    let current = true
    fetch('/api/log/days')
      .then((response) => response.json())
      .then((data: LogDays) => current && setLocation({ directory: data.directory, keepDays: data.keepDays }))
      .catch(() => undefined)
    return () => {
      current = false
    }
  }, [])
  return location
}
