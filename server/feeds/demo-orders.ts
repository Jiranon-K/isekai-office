import type { OrdersFeeds, OrdersView } from '../orders'

const DEMO_VIEW: OrdersView = {
  layers: [
    { scope: 'user', allow: ['Read', 'Bash(git status)'], deny: [], ask: ['Bash(git push *)'], error: null },
    { scope: 'project', allow: ['Bash(bun run check)'], deny: ['Read(./.env)'], ask: [], error: null },
    { scope: 'local', allow: ['Bash(bun test)'], deny: ['Bash(rm *)'], ask: [], error: null }
  ],
  writable: true
}

export const demoOrdersFeeds: OrdersFeeds = {
  async read() {
    return DEMO_VIEW
  },
  async change() {
    return { ok: true, error: null }
  }
}
