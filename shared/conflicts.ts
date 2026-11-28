export type FileConflict = {
  repo: string
  path: string
  agentIds: string[]
  updatedAt: number
}

export type ConflictSnapshot = {
  conflicts: FileConflict[]
  at: number
}
