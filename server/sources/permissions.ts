import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import type { OrderChange, OrderResult, RuleLayer, RuleScope } from '@shared/orders'

type SettingsDocument = Record<string, unknown>

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

let pendingWrite: Promise<unknown> = Promise.resolve()

function isRecord(value: unknown): value is SettingsDocument {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export function userSettingsPath(home: string): string {
  return join(home, '.claude', 'settings.json')
}

export function projectSettingsPath(worktree: string): string {
  return join(worktree, '.claude', 'settings.json')
}

export function localSettingsPath(worktree: string): string {
  return join(worktree, '.claude', 'settings.local.json')
}

export function parseSettings(text: string): SettingsDocument | null {
  try {
    const document: unknown = JSON.parse(text.replace(/^\uFEFF/, ''))
    return isRecord(document) ? document : null
  } catch {
    return null
  }
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (error instanceof Error && Reflect.get(error, 'code') === 'ENOENT') {
      return null
    }
    throw error
  }
}

function emptyLayer(scope: RuleScope, error: string | null): RuleLayer {
  return { scope, allow: [], deny: [], ask: [], error }
}

function listFrom(permissions: SettingsDocument, key: string): string[] {
  const list = permissions[key]
  return isStringList(list) ? list : []
}

export function layerFromDocument(scope: RuleScope, document: SettingsDocument): RuleLayer {
  const permissions = document.permissions
  if (!isRecord(permissions)) {
    return emptyLayer(scope, null)
  }
  return {
    scope,
    allow: listFrom(permissions, 'allow'),
    deny: listFrom(permissions, 'deny'),
    ask: listFrom(permissions, 'ask'),
    error: null
  }
}

export async function readLayer(scope: RuleScope, path: string): Promise<RuleLayer> {
  try {
    const text = await readText(path)
    if (text === null) {
      return emptyLayer(scope, null)
    }
    const document = parseSettings(text)
    return document ? layerFromDocument(scope, document) : emptyLayer(scope, 'unparseable')
  } catch {
    return emptyLayer(scope, 'unreadable')
  }
}

export async function readLayers(worktree: string | null, home: string): Promise<RuleLayer[]> {
  const user = await readLayer('user', userSettingsPath(home))
  if (worktree === null || !isAbsolute(worktree)) {
    return [user, emptyLayer('project', null), emptyLayer('local', null)]
  }
  return [user, await readLayer('project', projectSettingsPath(worktree)), await readLayer('local', localSettingsPath(worktree))]
}

export function editList(current: string[], change: OrderChange): string[] | null {
  const present = current.includes(change.rule)
  if (change.op === 'add') {
    return present ? null : [...current, change.rule]
  }
  return present ? current.filter((rule) => rule !== change.rule) : null
}

function editDocument(document: SettingsDocument, change: OrderChange): SettingsDocument | null | 'unparseable' {
  const permissions = document.permissions ?? {}
  if (!isRecord(permissions)) {
    return 'unparseable'
  }
  const current = permissions[change.list] ?? []
  if (!isStringList(current)) {
    return 'unparseable'
  }
  const next = editList(current, change)
  return next === null ? null : { ...document, permissions: { ...permissions, [change.list]: next } }
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

async function replaceFile(path: string, text: string, operations: SettingsFileOperations): Promise<OrderResult> {
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

function refusingChangedFile(expectedText: string | null, operations: SettingsFileOperations): SettingsFileOperations {
  return {
    ...operations,
    async rename(from, to) {
      if ((await readText(to)) !== expectedText) {
        throw new Error('settings file changed since it was read')
      }
      await operations.rename(from, to)
    }
  }
}

async function editFile(path: string, change: OrderChange, operations: SettingsFileOperations): Promise<OrderResult> {
  let text: string | null
  try {
    text = await readText(path)
  } catch {
    return { ok: false, error: 'unreadable' }
  }
  const document = text === null ? {} : parseSettings(text)
  if (document === null) {
    return { ok: false, error: 'unparseable' }
  }
  const edited = editDocument(document, change)
  if (edited === 'unparseable') {
    return { ok: false, error: 'unparseable' }
  }
  if (edited === null) {
    return { ok: true, error: null }
  }
  return replaceFile(path, `${JSON.stringify(edited, null, 2)}\n`, refusingChangedFile(text, operations))
}

async function isSymbolicLink(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isSymbolicLink()
  } catch {
    return false
  }
}

async function linksElsewhere(worktree: string): Promise<boolean> {
  return (await isSymbolicLink(join(worktree, '.claude'))) || (await isSymbolicLink(localSettingsPath(worktree)))
}

async function editSafely(worktree: string, change: OrderChange, operations: SettingsFileOperations): Promise<OrderResult> {
  if (await linksElsewhere(worktree)) {
    return { ok: false, error: 'unsafe_path' }
  }
  return editFile(localSettingsPath(worktree), change, operations)
}

export function changeLocalRule(worktree: string, change: OrderChange, operations: SettingsFileOperations = REAL_FILE_OPERATIONS): Promise<OrderResult> {
  if (!isAbsolute(worktree)) {
    return Promise.resolve({ ok: false, error: 'no_worktree' })
  }
  const result = pendingWrite.then(() => editSafely(worktree, change, operations))
  pendingWrite = result.catch(() => undefined)
  return result
}
