import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { HOTSPOTS } from '@/office/scene/hotspots'
import { isPanelId, type PanelId, type Route } from '@/lib/route'
import { replaySurfaces, routeForReplay, type Surface } from './replay-surfaces'

const PANELS = HOTSPOTS.map((hotspot) => hotspot.id).filter(isPanelId)

function routeOf(open: PanelId | null, agentId: string | null = null): Route {
  return { open, agentId }
}

describe('replaySurfaces', () => {
  test.each([
    { name: 'live, nothing open', route: routeOf(null), replaying: false, board: false, panel: null, queue: true, agentId: null, pick: true },
    { name: 'live, board', route: routeOf('questBoard'), replaying: false, board: true, panel: null, queue: true, agentId: null, pick: true },
    { name: 'live, reception', route: routeOf('reception'), replaying: false, board: false, panel: 'reception', queue: true, agentId: null, pick: true },
    { name: 'live, agent', route: routeOf(null, 'a'), replaying: false, board: false, panel: null, queue: true, agentId: 'a', pick: true },
    { name: 'replay, board by url', route: routeOf('questBoard'), replaying: true, board: false, panel: null, queue: false, agentId: null, pick: false },
    { name: 'replay, reception', route: routeOf('reception'), replaying: true, board: false, panel: null, queue: false, agentId: null, pick: false },
    { name: 'replay, door', route: routeOf('door'), replaying: true, board: false, panel: null, queue: false, agentId: null, pick: false },
    { name: 'replay, hearth', route: routeOf('hearth'), replaying: true, board: false, panel: 'hearth', queue: false, agentId: null, pick: false },
    { name: 'replay, agent', route: routeOf(null, 'a'), replaying: true, board: false, panel: null, queue: false, agentId: null, pick: false }
  ])('$name', ({ route, replaying, board, panel, queue, agentId, pick }) => {
    expect(replaySurfaces(route, replaying)).toEqual({ board, panel, queue, liveAgentId: agentId, acceptsPick: pick })
  })
})

describe('routeForReplay', () => {
  test('keeps only the hearth panel and drops the live agent', () => {
    expect(routeForReplay(routeOf('hearth', 'a'))).toEqual(routeOf('hearth'))
    expect(routeForReplay(routeOf('door', 'a'))).toEqual(routeOf(null))
    expect(routeForReplay(routeOf('questBoard'))).toEqual(routeOf(null))
  })
})

const POSTING: Record<string, Surface> = {
  'agent/CommandPanel.tsx': { kind: 'agent' },
  'agent/QuickReply.tsx': { kind: 'agent' },
  'agent/CompactButton.tsx': { kind: 'agent' },
  'agent/QueueBody.tsx': { kind: 'queue' },
  'agent/use-orders.ts': { kind: 'agent' },
  'board/SendToClaude.tsx': { kind: 'board' },
  'party/PartyComposer.tsx': { kind: 'panel', id: 'reception' },
  'room-panels/ArchiveSessionDetail.tsx': { kind: 'panel', id: 'archive' },
  'room-panels/SpawnForm.tsx': { kind: 'panel', id: 'door' },
  'room-panels/use-templates.ts': { kind: 'panel', id: 'door' }
}

const POST_CALLS = /\b(sendCommand|sendSpawn|sendOrderChange|saveTemplates|useCommand)\b/
const ROOT = join(import.meta.dir, '..')
const INFRASTRUCTURE = ['lib/api.ts', 'lib/templates-api.ts', 'agent/use-command.ts']

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) {
      return sourceFiles(path)
    }
    return /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [path] : []
  })
}

function isAllowed(surfaces: ReturnType<typeof replaySurfaces>, surface: Surface): boolean {
  if (surface.kind === 'board') {
    return surfaces.board
  }
  if (surface.kind === 'queue') {
    return surfaces.queue
  }
  if (surface.kind === 'agent') {
    return surfaces.liveAgentId !== null
  }
  return surfaces.panel === surface.id
}

describe('replay is read-only', () => {
  test('every file that can post is listed', () => {
    const found = sourceFiles(ROOT)
      .map((path) => relative(ROOT, path).split(sep).join('/'))
      .filter((relative) => !INFRASTRUCTURE.includes(relative))
      .filter((relative) => POST_CALLS.test(readFileSync(join(ROOT, relative), 'utf8')))
    expect(found.sort()).toEqual(Object.keys(POSTING).sort())
  })

  test('no listed surface is allowed in replay for any route', () => {
    const routes = [routeOf(null, 'a'), ...PANELS.map((id) => routeOf(id, null)), ...PANELS.map((id) => routeOf(id, 'a'))]
    for (const route of routes) {
      const surfaces = replaySurfaces(route, true)
      for (const [file, surface] of Object.entries(POSTING)) {
        expect([file, isAllowed(surfaces, surface)]).toEqual([file, false])
      }
    }
  })

  test('the hearth is the only panel replay can show', () => {
    const shown = PANELS.filter((id) => replaySurfaces(routeOf(id), true).panel !== null)
    expect(shown).toEqual(['hearth'])
  })
})
