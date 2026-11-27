import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BUILT_IN_TEMPLATES, toTemplates, type TemplateList } from '@shared/templates'
import { dataDir } from './data-dir'
import { REAL_FILE_OPERATIONS, replaceFile } from './sources/permissions'

export type TemplateReply = { status: number; body: TemplateList | { ok: boolean; error: string | null } }

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

function parseStored(text: string): TemplateList | null {
  try {
    const templates = toTemplates(JSON.parse(text))
    return templates === null ? null : { templates }
  } catch {
    return null
  }
}

export async function readTemplates(demo: boolean): Promise<TemplateReply> {
  if (demo) {
    return { status: 200, body: { templates: BUILT_IN_TEMPLATES } }
  }
  let text: string | null
  try {
    text = await readText(templatesPath())
  } catch {
    return failure(500, 'unreadable')
  }
  if (text === null) {
    return { status: 200, body: { templates: BUILT_IN_TEMPLATES } }
  }
  const stored = parseStored(text)
  return stored === null ? failure(500, 'unparseable') : { status: 200, body: stored }
}

async function saveTemplates(list: TemplateList): Promise<TemplateReply> {
  const result = await replaceFile(templatesPath(), `${JSON.stringify(list, null, 2)}\n`, REAL_FILE_OPERATIONS)
  return result.ok ? { status: 200, body: list } : failure(500, 'write_failed')
}

export async function replaceTemplates(body: unknown, demo: boolean): Promise<TemplateReply> {
  const templates = toTemplates(body)
  if (templates === null) {
    return failure(400, 'bad_request')
  }
  if (demo) {
    return { status: 200, body: { templates } }
  }
  const result = pendingWrite.then(() => saveTemplates({ templates }))
  pendingWrite = result.catch(() => undefined)
  return result
}
