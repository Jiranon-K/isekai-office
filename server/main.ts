import { join, normalize } from 'node:path'
import type { OfficeAgent } from '@shared/types'
import { toCommand } from './command'
import { board } from './feeds/board'
import { demoBoard, demoCommand, demoLog, demoRepos, demoSession, demoSnapshot, demoSpawn, demoSubscribe } from './feeds/demo'
import { currentLog, currentSnapshot, subscribe } from './feeds/office'
import { createWorktree, listRepos, sendCommand } from './sources/orca'
import { activeSource } from './sources/select'
import { handleSpawn } from './spawn'
import { isAllowedRequest } from './guard'
import { readOnlyReply } from './read-only'

const PORT = Number(process.env.PORT ?? 4300)
const PUBLIC_PORT = Number(process.env.PUBLIC_PORT ?? 4300)
const PORTS = { serverPort: PORT, publicPort: PUBLIC_PORT }
const DIST = join(import.meta.dir, '..', 'dist')
const DEV = process.argv.includes('--dev')
const DEMO = process.env.DEMO === '1'
const feeds = DEMO
  ? { subscribe: demoSubscribe, snapshot: demoSnapshot, board: demoBoard, log: demoLog, session: demoSession, command: demoCommand, repos: demoRepos, spawn: demoSpawn }
  : { subscribe, snapshot: currentSnapshot, board, log: async () => currentLog(), session: activeSource.readSession, command: sendCommand, repos: listRepos, spawn: createWorktree }
const encoder = new TextEncoder()

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function officeEvents(request: Request): Response {
  let unsubscribe = (): void => {}
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      unsubscribe = feeds.subscribe((snapshot) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`))
      })
      request.signal.addEventListener('abort', () => {
        unsubscribe()
        controller.close()
      })
    },
    cancel() {
      unsubscribe()
    }
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' }
  })
}

function agentFor(agentId: string): OfficeAgent | null {
  return feeds.snapshot().agents.find((agent) => agent.id === agentId) ?? null
}

function terminalFor(agentId: string): string | null {
  return agentFor(agentId)?.terminal ?? null
}

async function command(request: Request): Promise<Response> {
  const blocked = readOnlyReply(feeds.snapshot().caps, 'command')
  if (blocked) {
    return json(blocked, 409)
  }
  const parsed = toCommand(await request.json().catch(() => null))
  if (!parsed) {
    return json({ ok: false, error: 'bad_request' }, 400)
  }
  const terminal = terminalFor(parsed.agentId)
  if (!terminal) {
    return json({ ok: false, error: 'no_terminal' }, 409)
  }
  return json(await feeds.command(terminal, parsed))
}

async function repos(): Promise<Response> {
  try {
    return json({ repos: await feeds.repos() })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 502)
  }
}

async function spawn(request: Request): Promise<Response> {
  const blocked = readOnlyReply(feeds.snapshot().caps, 'spawn')
  if (blocked) {
    return json(blocked, 409)
  }
  const body = await request.json().catch(() => null)
  const reply = await handleSpawn(body, { repos: feeds.repos, spawn: feeds.spawn })
  return json(reply.result, reply.status)
}

async function session(id: string): Promise<Response> {
  try {
    return json(await feeds.session(id, agentFor(id)))
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 502)
  }
}

async function staticFile(pathname: string): Promise<Response> {
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  const file = Bun.file(join(DIST, safe))
  if (safe !== '/' && (await file.exists())) {
    return new Response(file, { headers: { 'Cache-Control': safe.startsWith('/assets/') ? 'max-age=31536000, immutable' : 'no-cache' } })
  }
  return new Response(Bun.file(join(DIST, 'index.html')), { headers: { 'Cache-Control': 'no-cache' } })
}

async function route(request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (!isAllowedRequest(request, PORTS)) {
    return json({ error: 'forbidden' }, 403)
  }
  if (url.pathname === '/api/office/events') {
    return officeEvents(request)
  }
  if (url.pathname === '/api/log') {
    return json(await feeds.log())
  }
  if (url.pathname === '/api/board') {
    return json(await feeds.board(url.searchParams.has('refresh')))
  }
  if (url.pathname.startsWith('/api/session/')) {
    return session(decodeURIComponent(url.pathname.slice('/api/session/'.length)))
  }
  if (url.pathname === '/api/command' && request.method === 'POST') {
    return command(request)
  }
  if (url.pathname === '/api/repos') {
    return repos()
  }
  if (url.pathname === '/api/spawn' && request.method === 'POST') {
    return spawn(request)
  }
  if (url.pathname.startsWith('/api/')) {
    return json({ error: 'not_found' }, 404)
  }
  if (DEV) {
    return new Response('Open http://localhost:4300 (Vite dev server)', { status: 404 })
  }
  return staticFile(url.pathname)
}

Bun.serve({ hostname: '127.0.0.1', port: PORT, idleTimeout: 0, fetch: route })

console.log(`isekai-office${DEMO ? ' (demo data)' : ''} on http://localhost:${PORT}`)
