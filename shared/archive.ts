export type ArchivedSession = {
  id: string
  title: string
  repo: string | null
  modifiedAt: number
  size: number
  active: boolean
}

export type ArchiveListResponse = {
  sessions: ArchivedSession[]
  total: number
  truncated: boolean
}
