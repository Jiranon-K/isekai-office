export const URL_WRITE_INTERVAL_MS = 250

export function urlWriteDelay(now: number, lastWrite: number): number {
  const elapsed = now - lastWrite
  if (elapsed < 0 || elapsed >= URL_WRITE_INTERVAL_MS) {
    return 0
  }
  return URL_WRITE_INTERVAL_MS - elapsed
}
