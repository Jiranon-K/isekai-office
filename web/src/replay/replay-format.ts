function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatClock(at: number): string {
  const moment = new Date(at)
  return `${pad(moment.getHours())}:${pad(moment.getMinutes())}`
}

export function formatClockSeconds(at: number): string {
  return `${formatClock(at)}:${pad(new Date(at).getSeconds())}`
}

export function localDateOf(at: number): string {
  const moment = new Date(at)
  return `${moment.getFullYear()}-${pad(moment.getMonth() + 1)}-${pad(moment.getDate())}`
}
