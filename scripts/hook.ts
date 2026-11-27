import { forwardedBody, HOOK_DEADLINE_MS, hookUrl, postHook, readStdin } from './hook-post'

const startedAt = Date.now()
const body = await readStdin(HOOK_DEADLINE_MS)

const forwarded = forwardedBody(body)

const remainingMs = HOOK_DEADLINE_MS - (Date.now() - startedAt)

if (forwarded !== null && remainingMs > 0) {
  await postHook(hookUrl(process.env.ISEKAI_PORT), forwarded, remainingMs)
}

process.exit(0)
