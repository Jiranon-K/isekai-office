const TIMEOUT_MS = 15_000

export async function runText(command: string[]): Promise<string> {
  const child = Bun.spawn(command, { stdout: 'pipe', stderr: 'pipe', timeout: TIMEOUT_MS })
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ])
  if (code !== 0 && !stdout.trim()) {
    throw new Error(stderr.trim() || `${command[0]} exited ${code}`)
  }
  return stdout
}

export async function runJson<T>(command: string[]): Promise<T> {
  return JSON.parse(await runText(command))
}
