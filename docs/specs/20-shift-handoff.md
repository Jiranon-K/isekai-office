# Shift Handoff

Date: 2026-11-28
Branch: `feat/20-shift-handoff`

## Problem

When an agent's context window is nearly full or it finishes a task ready for review, starting a successor session requires manually copying the repo, branch, last summary, and context into the door spawn form.

## Where it lives in the room

- **Character (`CommandPanel` header)**: Add a `ส่งไม้ต่อ` button (or `คัดลอกส่งไม้ต่อ` when `caps.spawn === false`).
- **Crystal Orb (`OrbPanel`)**: Add a compact `ส่งไม้ต่อ` button beside `CompactButton` on high-load sessions (`isOverLoad`).
- **Door (`DoorPanel` -> `SpawnForm`)**: Opens directly on the `เรียกคนใหม่` tab pre-filled with the handoff draft and a subtle source banner (`รับช่วงต่อจาก <title>`) with a `ล้างค่า` button.

No navbar, no settings page, and no new server routes or server memory overhead.

## Data shapes and pure logic

Create `shared/handoff.ts`:

```ts
import type { OfficeAgent, OrcaRepo, SessionEntry } from './types'

export type HandoffDraft = {
  sourceAgentId: string
  sourceTitle: string
  repoName: string | null
  name: string
  baseBranch: string
  prompt: string
  fallbackUsed: boolean
}
```

Pure functions in `shared/handoff.ts` (with `shared/handoff.test.ts`):

- `suggestHandoffName(title: string, agentId: string): string`
  - Converts `title` into a valid worktree name matching `NAME_PATTERN` (`/^[a-z0-9][a-z0-9-]{0,47}$/`), prefixed with `handoff-` (e.g. `APP-12 dark mode toggle` -> `handoff-app-12-dark-mode-toggle`), falling back to `handoff-${safeId}` when the title has no ASCII slug characters (such as Thai-only titles). Always <= 48 chars and passes `isValidName`.
- `buildHandoffPrompt(agent: OfficeAgent, entries: readonly SessionEntry[]): string`
  - Builds a concise, structured handoff prompt capped strictly at `PROMPT_MAX` (4000 chars):
    - Source task title, repo, workspace/branch, and state
    - First user goal (from earliest `role === 'user'` entry, trimmed to 600 chars)
    - Latest assistant summary (from last non-empty `role === 'assistant'` entry, or `agent.lastMessage`, trimmed to 1500 chars)
    - Clear continuation line: `Continue or review this work from the current branch state. Verify before editing.`
- `matchRepoId(repos: readonly OrcaRepo[], repoName: string | null): string`
  - Matches `repoName` case-insensitively against `repos[].name` (or falls back to `repos[0]?.id ?? ''`).
- `createHandoffDraft(agent: OfficeAgent, entries: readonly SessionEntry[] | null): HandoffDraft`
  - Uses `entries ?? []`, sets `fallbackUsed: entries === null`, sets `baseBranch: agent.workspace && isValidBaseBranch(agent.workspace) ? agent.workspace : ''`.

## User flow and states

1. **Triggering handoff (writable source, `caps.spawn === true`)**:
   - User clicks `ส่งไม้ต่อ` on a character's `CommandPanel` header or on an overloaded row in `OrbPanel`.
   - Button enters brief loading state while calling existing `fetchSession(agent.id)` to grab the latest transcript entries.
   - If `fetchSession` succeeds, builds `HandoffDraft` with `fallbackUsed: false`.
   - If `fetchSession` fails, builds `HandoffDraft` with `entries = null` (`fallbackUsed: true`) using `agent.title` and `agent.lastMessage`.
   - `App.tsx` stores `handoffDraft` in local React state, clears `selectedId`, and opens `DoorPanel` on the `spawn` tab.
2. **Door spawn form with handoff draft**:
   - `SpawnForm` populates `repoId` (via `matchRepoId`), `name`, `baseBranch`, and `prompt` from `handoffDraft`.
   - Shows a compact banner above the form: `รับช่วงต่อจาก <sourceTitle>` with a `ล้างค่า` button that clears the draft and resets form fields.
   - If `fallbackUsed` is true, banner includes a short note `ดึงประวัติแชทไม่ได้ ใช้สรุปล่าสุดแทน`.
   - Submitting successfully clears `handoffDraft` as well as form fields.
   - If the user already typed a custom prompt before clicking handoff, replacing is explicit because handoff opened a fresh DoorPanel draft.
3. **Read-only source (`caps.spawn === false`, where `/api/spawn` returns `409 read_only_source`)**:
   - Button label is `คัดลอกส่งไม้ต่อ`.
   - Clicking fetches transcript (with same fallback), builds the handoff prompt, copies it via `navigator.clipboard.writeText`, and changes label to `คัดลอกแล้ว` for 2 seconds.
   - If clipboard write fails (e.g. denied permission), opens a small inline read-only textarea inside the panel with the prompt pre-selected so the user can press Ctrl+C manually.
4. **Empty state**: If an agent has no transcript entries and no `lastMessage`, `buildHandoffPrompt` still produces a valid prompt containing the title, repo/branch, and continuation instruction.

## Constraints

- Zero new server routes, zero extra server RAM, zero new npm dependencies.
- Keep all files under 300 lines, no comments or docstrings in code.

## Acceptance criteria (QA in `bun run demo`)

- [ ] Clicking any character (e.g. `a7` `APP-9 empty states`) shows `ส่งไม้ต่อ` in `CommandPanel` header.
- [ ] Clicking `ส่งไม้ต่อ` closes `CommandPanel`, opens `ประตู` on `เรียกคนใหม่`, shows banner `รับช่วงต่อจาก APP-9 empty states`, and pre-fills `ชื่อ worktree` (`handoff-app-9-empty-states`), `Base branch` (`main`), and `prompt แรก` with the session summary.
- [ ] Clicking `ล้างค่า` clears the banner and resets the fields.
- [ ] Clicking `ลูกแก้ว` shows `ส่งไม้ต่อ` on high-load agent `a6` (`OPS-9 rotate signing keys`, 70.5% context) next to `CompactButton`, and clicking it opens `ประตู` pre-filled for `a6`.
- [ ] Submitting the pre-filled form in demo mode succeeds and shows `เรียกแล้ว รอสักครู่จะเดินเข้ามา`.
- [ ] Unit tests verify `suggestHandoffName` (including Thai-only titles and 48-char limit), `buildHandoffPrompt` (`<= 4000` chars), `matchRepoId`, and read-only clipboard fallback behavior.
- [ ] `bun run check` passes cleanly.

## Out of scope

- Closing or killing the source session automatically.
- Persisting handoff drafts to disk or URL query parameters.
- Cross-machine handoff or server-side LLM summarization.
