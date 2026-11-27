import { readTemplates, replaceTemplates, type TemplateReply } from './templates'

export const TEMPLATES_BODY_MAX_BYTES = 200 * 1024

function isTooLarge(request: Request): boolean {
  return Number(request.headers.get('content-length') ?? 0) > TEMPLATES_BODY_MAX_BYTES
}

function json(reply: TemplateReply): Response {
  return Response.json(reply.body, { status: reply.status, headers: { 'Cache-Control': 'no-store' } })
}

export async function handleTemplates(request: Request, demo: boolean): Promise<Response | null> {
  if (new URL(request.url).pathname !== '/api/templates') {
    return null
  }
  if (request.method === 'GET') {
    return json(await readTemplates(demo))
  }
  if (request.method === 'PUT') {
    if (isTooLarge(request)) {
      return json({ status: 413, body: { ok: false, error: 'too_large' } })
    }
    return json(await replaceTemplates(await request.json().catch(() => null), demo))
  }
  return null
}
