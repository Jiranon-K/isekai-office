import type { ArchiveListResponse } from '@shared/archive'
import type { SessionDetail } from '@shared/types'

export async function fetchArchiveList(query: string, repo: string): Promise<ArchiveListResponse> {
  const params = new URLSearchParams()
  const trimmedQuery = query.trim()
  if (trimmedQuery !== '') {
    params.set('q', trimmedQuery)
  }
  if (repo !== '') {
    params.set('repo', repo)
  }
  const search = params.toString()
  const response = await fetch(search ? `/api/archive?${search}` : '/api/archive')
  if (!response.ok) {
    throw new Error('archive_unavailable')
  }
  return response.json()
}

export async function fetchArchivedSession(id: string): Promise<SessionDetail> {
  const response = await fetch(`/api/archive/${encodeURIComponent(id)}`)
  if (!response.ok) {
    throw new Error('archive_session_unavailable')
  }
  return response.json()
}
