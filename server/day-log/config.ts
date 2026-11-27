const DEFAULT_KEEP_DAYS = 14
const DEFAULT_DAY_MAX_BYTES = 5 * 1024 * 1024

function positiveWhole(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback
}

export function keepDaysFrom(value: string | undefined): number {
  return positiveWhole(value, DEFAULT_KEEP_DAYS)
}

export function dayMaxBytesFrom(value: string | undefined): number {
  return positiveWhole(value, DEFAULT_DAY_MAX_BYTES)
}

export function keepDays(): number {
  return keepDaysFrom(process.env.LOG_KEEP_DAYS)
}

export function dayMaxBytes(): number {
  return dayMaxBytesFrom(process.env.LOG_DAY_MAX_BYTES)
}
