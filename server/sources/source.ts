import type { OfficeAgent, SessionDetail, SourceAgent, SourceCaps, SourceId } from '@shared/types'

export type SessionSource = {
  id: SourceId
  caps: SourceCaps
  ready(): Promise<boolean>
  listAgents(): Promise<SourceAgent[]>
  readSession(id: string, agent: OfficeAgent | null): Promise<SessionDetail>
  managedStats?(): { count: number; cap: number }
}
