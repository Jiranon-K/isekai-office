import type { OfficeAgent, SessionDetail, SourceCaps, SourceId } from '@shared/types'

export type SessionSource = {
  id: SourceId
  caps: SourceCaps
  ready(): Promise<boolean>
  listAgents(): Promise<OfficeAgent[]>
  readSession(id: string, agent: OfficeAgent | null): Promise<SessionDetail>
}
