import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BUILT_IN_TEMPLATES, NO_FILE_REVISION, toTemplates, type QuestTemplate, type TemplateSnapshot } from '@shared/templates'
import { dataDir } from './data-dir'
import { REAL_FILE_OPERATIONS, replaceFile } from './atomic-file'

export type TemplateReply = { status: number; body: TemplateSnapshot | { ok: boolean; error: string | null } }

let pendingWrite: Promise<unknown> = Promise.resolve()

export function templatesPath(): string {
  return join(dataDir(), 'templates.json')
}

function failure(status: number, error: string): TemplateReply {
  return { status, body: { ok: false, error } }
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

export function revisionOf(text: string | null): string {
  return text === null ? NO_FILE_REVISION : createHash('sha1').update(text).digest('hex')
}

function parseStored(text: string): TemplateSnapshot | null {
  try {
    const templates = toTemplates(JSON.parse(text))
    return templates === null ? null : { templates, revision: revisionOf(text) }
  } catch {
    return null
  }
}

export async function readTemplates(demo: boolean): Promise<TemplateReply> {
  if (demo) {
    return { status: 200, body: { templates: BUILT_IN_TEMPLATES, revision: NO_FILE_REVISION } }
  }
  let text: string | null
  try {
    text = await readText(templatesPath())
  } catch {
    return failure(500, 'unreadable')
  }
  if (text === null) {
    return { status: 200, body: { templates: BUILT_IN_TEMPLATES, revision: NO_FILE_REVISION } }
  }
  const stored = parseStored(text)
  return stored === null ? failure(500, 'unparseable') : { status: 200, body: stored }
}

async function saveTemplates(templates: QuestTemplate[], revision: string): Promise<TemplateReply> {
  let current: string | null
  try {
    current = await readText(templatesPath())
  } catch {
    return failure(500, 'unreadable')
  }
  if (revisionOf(current) !== revision) {
    return failure(409, 'stale')
  }
  const text = `${JSON.stringify({ templates }, null, 2)}
`
  const result = await replaceFile(templatesPath(), text, REAL_FILE_OPERATIONS)
  return result.ok ? { status: 200, body: { templates, revision: revisionOf(text) } } : failure(500, 'write_failed')
}

function revisionFrom(body: unknown): string | null {
  const revision = typeof body === 'object' && body !== null ? Reflect.get(body, 'revision') : undefined
  return typeof revision === 'string' ? revision : null
}

export async function replaceTemplates(body: unknown, demo: boolean): Promise<TemplateReply> {
  const templates = toTemplates(body)
  const revision = revisionFrom(body)
  if (templates === null || revision === null) {
    return failure(400, 'bad_request')
  }
  if (demo) {
    return { status: 200, body: { templates, revision: NO_FILE_REVISION } }
  }
  const result = pendingWrite.then(() => saveTemplates(templates, revision))
  pendingWrite = result.catch(() => undefined)
  return result
}
