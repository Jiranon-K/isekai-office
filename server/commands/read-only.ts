import type { SourceCaps } from '@shared/types'

export type ReadOnlyKind = 'command' | 'spawn'

export function readOnlyReply(caps: SourceCaps, kind: ReadOnlyKind): { ok: false; error: 'read_only_source' } | null {
  return caps[kind] ? null : { ok: false, error: 'read_only_source' }
}
