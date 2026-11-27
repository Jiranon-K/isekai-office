import { hookUrl, postHook, readStdin } from './hook-post'

const body = await readStdin()

if (body.trim() !== '') {
  await postHook(hookUrl(process.env.ISEKAI_PORT), body)
}

process.exit(0)
