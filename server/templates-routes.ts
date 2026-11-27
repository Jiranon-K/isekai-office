import { readTemplates, replaceTemplates, type TemplateReply } from './templates'

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
    return json(await replaceTemplates(await request.json().catch(() => null), demo))
  }
  return null
}
