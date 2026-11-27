import { readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'

const SUFFIX = '.jsonl'

export type RecentFile = { id: string; path: string; modifiedAt: number; size: number }

export type RecentFilesOptions = {
  projectsDir: string
  recentMs: number
  refreshMs: number
  now?: () => number
}

async function statOrNull(path: string): Promise<{ mtimeMs: number; size: number } | null> {
  return stat(path).catch(() => null)
}

async function scanFolder(folder: string, cutoff: number): Promise<RecentFile[]> {
  const names = await readdir(folder).catch(() => [])
  const found = await Promise.all(
    names
      .filter((name) => name.endsWith(SUFFIX))
      .map(async (name) => {
        const path = join(folder, name)
        const info = await statOrNull(path)
        if (!info || info.mtimeMs < cutoff) {
          return null
        }
        return { id: basename(name, SUFFIX), path, modifiedAt: info.mtimeMs, size: info.size }
      })
  )
  return found.filter((file) => file !== null)
}

async function projectFolders(projectsDir: string): Promise<string[]> {
  const entries = await readdir(projectsDir, { withFileTypes: true }).catch(() => [])
  return entries.filter((entry) => entry.isDirectory()).map((entry) => join(projectsDir, entry.name))
}

export function createRecentFiles(options: RecentFilesOptions): { list(): Promise<RecentFile[]> } {
  const now = options.now ?? Date.now
  const known = new Map<string, RecentFile>()
  const folderStamps = new Map<string, number>()
  let refreshedAt = Number.NEGATIVE_INFINITY

  async function restat(cutoff: number): Promise<void> {
    await Promise.all(
      [...known.values()].map(async (file) => {
        const info = await statOrNull(file.path)
        if (!info || info.mtimeMs < cutoff) {
          known.delete(file.path)
          return
        }
        known.set(file.path, { ...file, modifiedAt: info.mtimeMs, size: info.size })
      })
    )
  }

  async function rescanFolder(folder: string, cutoff: number): Promise<void> {
    for (const file of await scanFolder(folder, cutoff)) {
      known.set(file.path, file)
    }
  }

  async function rescanChangedFolders(cutoff: number, everything: boolean): Promise<void> {
    const folders = await projectFolders(options.projectsDir)
    await Promise.all(
      folders.map(async (folder) => {
        const stamp = (await statOrNull(folder))?.mtimeMs ?? 0
        if (!everything && folderStamps.get(folder) === stamp) {
          return
        }
        folderStamps.set(folder, stamp)
        await rescanFolder(folder, cutoff)
      })
    )
  }

  async function list(): Promise<RecentFile[]> {
    const current = now()
    const cutoff = current - options.recentMs
    const everything = current - refreshedAt >= options.refreshMs
    if (everything) {
      refreshedAt = current
    }
    await restat(cutoff)
    await rescanChangedFolders(cutoff, everything)
    return [...known.values()].sort((first, second) => second.modifiedAt - first.modifiedAt)
  }

  return { list }
}
