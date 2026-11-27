import { forwardedBody, hookUrl, postHook, readStdin } from './hook-post'

const body = await readStdin()

const forwarded = forwardedBody(body)

if (forwarded !== null) {
  await postHook(hookUrl(process.env.ISEKAI_PORT), forwarded)
}

process.exit(0)
