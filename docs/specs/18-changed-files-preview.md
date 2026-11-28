# Changed Files Preview

Date: 2026-11-28
Branch: `feat/18-changed-files`

## Problem

While watching several agent sessions all day, the owner sees only chat messages and 14 terminal lines and cannot tell which files an agent touched or how large the diff is before approving a prompt or reviewing finished work.

## Where it lives in the room

- **Character (`CommandPanel`)**: Add a third tab `ไฟล์ที่แก้` in `web/src/agent/PanelTabs.tsx` (`'chat' | 'files' | 'orders'`). Opening it shows the branch name, total insertions/deletions, and the list of modified/added/deleted/renamed/untracked files in that agent's worktree.
- **Bar shelf (`BarPanel`, `เสร็จแล้ว` tab)**: Show a compact diff badge (`3 ไฟล์ · +42 -8` or `ไม่มีไฟล์แก้`) under each finished session in `web/src/room-panels/BarPanel.tsx`, loaded on-demand only when the bar panel opens.

No navbar and no settings page.

## Data shapes and API

Create `shared/diff.ts`:

```ts
export type FileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'

export type ChangedFile = {
  path: string
  status: FileStatus
  added: number
  removed: number
}

export type AgentDiff = {
  agentId: string
  branch: string | null
  files: ChangedFile[]
  totalAdded: number
  totalRemoved: number
  truncated: boolean
  error: string | null
}

export type DiffSummary = {
  agentId: string
  files: number
  added: number
  removed: number
  clean: boolean
  unavailable: boolean
}

export type DiffSummaryResponse = { summaries: DiffSummary[] }
```

Server routes (`server/diff/routes.ts`, wired in `server/main.ts` after `isAllowedRequest`):

- `GET /api/diff/:agentId`
  - Unknown agent: `404 { error: 'agent_not_found' }`.
  - Agent without `worktree`: `200` with `{ agentId, branch: null, files: [], totalAdded: 0, totalRemoved: 0, truncated: false, error: 'no_worktree' }`.
  - Real feed (`server/diff/git.ts`): runs `git status --porcelain=v1 -b`, `git diff --numstat`, and `git diff --cached --numstat` inside `agent.worktree` with a 3-second timeout. Merges line counts by file path, caps output at 100 files (`truncated: true` if more), and never polls in the background.
  - Rejects unsafe worktree paths (filesystem root or home dir, reusing the same boundary check pattern as `server/orders.ts`) with `error: 'not_a_repo'`.
  - Non-git directory or git command failure returns `200` with `error: 'git_unavailable'` (never crashes the server).
- `GET /api/diff-summary?ids=a1,a7`
  - Parses comma-separated agent IDs (capped at 20). Computes summaries concurrently on-demand for requested agents only.
  - Unknown IDs or missing worktrees return `{ agentId, files: 0, added: 0, removed: 0, clean: false, unavailable: true }`.
- Demo feed (`server/diff/demo-diff.ts`):
  - `a1`: 3 files (`modified`, `added`), `+64 -12`, branch `feat/dark-mode`.
  - `a5`: 2 files (`modified`, `untracked`), `+38 -4`, branch `feat/onboarding`.
  - `a7`: 4 files (`modified`, `added`, `deleted`), `+112 -29`, branch `feat/empty-states`.
  - `a8`: clean worktree (`files: []`, `error: null`, branch `docs/changelog`).
  - `a6`: `error: 'no_worktree'`.
  - Any other demo agent: 1 modified file `+14 -3`.

## User flow and states

1. User clicks a character to open `CommandPanel`, then switches to the `ไฟล์ที่แก้` tab.
2. **Loading**: Shows a spinner or skeleton while `GET /api/diff/:agentId` runs.
3. **Loaded with changes**: Header shows branch badge, file count, `+added` (green) and `-removed` (red), plus a `รีเฟรช` button. Below is a scrollable list with status badge (`M`, `A`, `D`, `R`, `?`), file path in monospace, and `+N -M` counts. If `truncated` is true, shows a note `แสดง 100 ไฟล์แรกเท่านั้น`.
4. **Empty (clean)**: Shows `ยังไม่มีไฟล์ที่แก้ใน worktree นี้`.
5. **No worktree**: Shows `session นี้ไม่มี worktree ให้ตรวจไฟล์`.
6. **Error**: Shows `อ่านสถานะ git ไม่ได้` with a `ลองใหม่` button.
7. **Read-only (`local` source)**: Fully available because inspecting git status is read-only. Never triggers `409 read_only_source`.
8. **Bar shelf (`เสร็จแล้ว` tab)**: Opening `ชั้นบาร์` fetches `GET /api/diff-summary` for done sessions once and renders a subtle diff badge (`4 ไฟล์ · +112 -29` or `ไม่มีไฟล์แก้`) inside `SessionList`'s `detail` prop. Failed summary requests fail silently without breaking the session list.

## Constraints

- One Bun process, no database, no background polling, no new npm packages.
- On-demand execution only when the user opens the tab or bar shelf.
- Keep all new files under 300 lines, no comments or docstrings in code.

## Acceptance criteria (QA in `bun run demo`)

- [ ] Clicking agent `a1` (`APP-12 dark mode toggle`) opens `CommandPanel` with 3 tabs: `แชท`, `ไฟล์ที่แก้`, `คำสั่งประจำ`.
- [ ] Switching to `ไฟล์ที่แก้` on `a1` shows branch `feat/dark-mode`, `+64 -12`, and 3 file rows with status badges and line counts.
- [ ] Clicking `รีเฟรช` re-fetches without errors.
- [ ] Switching to `ไฟล์ที่แก้` on `a8` (`Write API changelog`) shows empty state `ยังไม่มีไฟล์ที่แก้ใน worktree นี้`.
- [ ] Switching to `ไฟล์ที่แก้` on `a6` (`OPS-9 rotate signing keys`) shows `session นี้ไม่มี worktree ให้ตรวจไฟล์`.
- [ ] Opening `ชั้นบาร์` -> `เสร็จแล้ว` shows `a7` with `4 ไฟล์ · +112 -29` and `a8` with `ไม่มีไฟล์แก้`.
- [ ] `bun run check` passes with zero errors and bundle sizes stay within budget delta.

## Out of scope

- Full patch / inline line-by-line diff viewer.
- Staging, committing, or reverting files from the UI.
- Background git polling on every office tick.
