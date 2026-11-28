export type FileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'

export type ChangedFile = {
  path: string
  status: FileStatus
  added: number
  removed: number
}

export type AgentDiff = {
  agentId: string
  branch: string | null
  files: ChangedFile[]
  totalAdded: number
  totalRemoved: number
  truncated: boolean
  error: string | null
}

export type DiffSummary = {
  agentId: string
  files: number
  added: number
  removed: number
  clean: boolean
  unavailable: boolean
}

export type DiffSummaryResponse = { summaries: DiffSummary[] }
