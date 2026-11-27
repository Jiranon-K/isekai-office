import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { OrderResult } from '@shared/orders'

export type SettingsFileOperations = {
  makeFolder(path: string): Promise<void>
  writeFile(path: string, text: string): Promise<void>
  rename(from: string, to: string): Promise<void>
  removeFile(path: string): Promise<void>
}

export const REAL_FILE_OPERATIONS: SettingsFileOperations = {
  makeFolder: async (path) => void (await mkdir(path, { recursive: true })),
  writeFile: (path, text) => writeFile(path, text, 'utf8'),
  rename,
  removeFile: (path) => rm(path, { force: true })
}

const RENAME_RETRY_CODES = ['EPERM', 'EBUSY']

const RENAME_RETRIES = 3

const RENAME_RETRY_DELAY_MILLISECONDS = 25

function shouldRetryRename(error: unknown): boolean {
  return error instanceof Error && RENAME_RETRY_CODES.includes(String(Reflect.get(error, 'code')))
}

async function renameWithRetry(operations: SettingsFileOperations, from: string, to: string): Promise<void> {
  for (let retry = 0; ; retry += 1) {
    try {
      return await operations.rename(from, to)
    } catch (error) {
      if (retry >= RENAME_RETRIES || !shouldRetryRename(error)) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, RENAME_RETRY_DELAY_MILLISECONDS))
    }
  }
}

export async function replaceFile(path: string, text: string, operations: SettingsFileOperations): Promise<OrderResult> {
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`
  try {
    await operations.makeFolder(dirname(path))
    await operations.writeFile(temporary, text)
    await renameWithRetry(operations, temporary, path)
    return { ok: true, error: null }
  } catch {
    await operations.removeFile(temporary).catch(() => undefined)
    return { ok: false, error: 'write_failed' }
  }
}
