import type { SourceId } from '@shared/types'
import { localSource } from './local'
import { orcaBinaryExists, orcaSource } from './orca'
import type { SessionSource } from './source'

export function chooseSourceId(setting: string | undefined, orcaPresent: boolean): SourceId {
  if (setting === 'orca' || setting === 'local') {
    return setting
  }
  return orcaPresent ? 'orca' : 'local'
}

export function sourceFor(id: SourceId): SessionSource {
  return id === 'orca' ? orcaSource : localSource
}

export const activeSource: SessionSource = sourceFor(chooseSourceId(process.env.SESSION_SOURCE, await orcaBinaryExists()))
