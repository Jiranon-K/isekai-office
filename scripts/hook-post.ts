const DEFAULT_PORT = 4300
const REQUEST_TIMEOUT_MS = 1_000

export function hookUrl(port: string | undefined): string {
  const parsed = Number(port)
  const resolved = Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : DEFAULT_PORT
  return `http://127.0.0.1:${resolved}/api/hook`
}

export function originOf(url: string): string {
  return new URL(url).origin
}

export async function postHook(url: string, body: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: originOf(url) },
      body,
      signal: AbortSignal.timeout(timeoutMs)
    })
    return response.ok
  } catch {
    return false
  }
}

export async function readStdin(timeoutMs = REQUEST_TIMEOUT_MS): Promise<string> {
  const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(''), timeoutMs))
  return Promise.race([Bun.stdin.text().catch(() => ''), timeout])
}
