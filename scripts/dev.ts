import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const SERVER_PORT = '4302'
const PUBLIC_PORT = '4300'
const VITE_BIN = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')

function start(command: string[], env: Record<string, string>): Bun.Subprocess {
  return Bun.spawn(command, { cwd: ROOT, env: { ...process.env, ...env }, stdout: 'inherit', stderr: 'inherit' })
}

const server = start([process.execPath, '--watch', 'server/main.ts', '--dev'], { PORT: SERVER_PORT, PUBLIC_PORT })
const vite = start([process.execPath, '--bun', VITE_BIN], { SERVER_PORT })
const children = [server, vite]

function stopAll(): void {
  for (const child of children) {
    child.kill()
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopAll()
    process.exit(0)
  })
}

process.on('exit', stopAll)

const firstExit = await Promise.race(children.map((child) => child.exited))
stopAll()
process.exit(firstExit)
