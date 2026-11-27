import { homedir } from 'node:os'
import { join } from 'node:path'
import type { LoopStage } from '@shared/types'
import { runText } from '../run'

const LOOP_STATE = process.env.LOOP_STATE_BIN ?? join(homedir(), 'loop', 'bin', 'loop-state')

export function parseLoopState(output: string): Map<string, LoopStage> {
  const stages = new Map<string, LoopStage>()
  for (const line of output.split('\n')) {
    const [ticket, ...pairs] = line.trim().split(/\s+/)
    if (!ticket) {
      continue
    }
    const fields = new Map(pairs.map((pair) => [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)]))
    const status = fields.get('status')
    if (status) {
      stages.set(ticket, {
        status,
        mr: fields.get('mr') ?? null,
        worktree: fields.get('wt') ?? null,
        session: fields.get('session') ?? null
      })
    }
  }
  return stages
}

export async function loadLoopStages(): Promise<Map<string, LoopStage>> {
  try {
    return parseLoopState(await runText([LOOP_STATE, 'list']))
  } catch {
    return new Map()
  }
}
