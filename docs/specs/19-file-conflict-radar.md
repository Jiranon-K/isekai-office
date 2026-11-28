# File Conflict Radar

Date: 2026-11-28
Branch: `feat/19-conflict-radar`

## Problem

When running multiple coding agents in parallel on the same repository, two agents can silently edit the same file at the same time and create painful merge conflicts discovered only at PR time.

## Where it lives in the room

- **Crystal Orb (`OrbPanel`)**: Add tabs `โหลด context` (existing view) and `ไฟล์ชนกัน` (conflict list with count badge when conflicts > 0).
- **Characters on Canvas (`OfficeCanvas` / `labels.ts` / `signals.ts`)**: Show a small amber/red conflict warning pip on the actor plate of every agent involved in an active file conflict, and tint the orb ring when conflicts exist.

No navbar and no settings page.

## Data shapes and API

Create `shared/conflicts.ts`:

```ts
export type FileConflict = {
  repo: string
  path: string
  agentIds: string[]
  updatedAt: number
}

export type ConflictSnapshot = {
  conflicts: FileConflict[]
  at: number
}
```

Server implementation (`server/conflicts/`):

- `server/conflicts/touched.ts`: pure helper `extractTouchedPaths(lines: string[], worktree: string | null, limit = 50): string[]` that inspects assistant `tool_use` blocks in transcript lines for write tools (`Edit`, `Write`, `MultiEdit`, `NotebookEdit`), extracts `input.file_path` or `input.path` (or `notebook_path`), normalizes slashes (`\` -> `/`), makes paths relative to `worktree` when inside it, and keeps the latest 50 unique paths per session.
- `server/conflicts/detect.ts`: pure helper `detectConflicts(entries: AgentTouched[]): FileConflict[]` that filters to active non-done agents (`state !== 'done'`), groups by `(repo ?? worktree ?? 'unknown', normalizedPath.toLowerCase())`, preserves the first display path, and emits a `FileConflict` whenever 2 or more distinct `agentIds` touch the same file in the same repo, sorted by `updatedAt` descending.
- `server/conflicts/routes.ts` (wired in `server/main.ts` after `isAllowedRequest`):
  - `GET /api/conflicts`:
    - In `DEMO=1` (`server/conflicts/demo-conflicts.ts`): returns 2 deterministic conflicts in `web-app`:
      1. `src/checkout/cart.ts` touched by `['a1', 'a2']`
      2. `src/checkout/summary.tsx` touched by `['a1', 'a5']`
    - In live mode: reads the bounded touched-file map computed on-demand from each active agent's transcript tail (reusing `readTail` + `mtimeMs:size` cache capped to active sessions only, forgetting departed sessions so server RAM stays flat).

## User flow and states

1. **Ambient awareness in the room**: When `agents` list updates (keyed by active agent IDs + `updatedAt`), the frontend fetches `GET /api/conflicts` once (no extra interval polling). Agents present in any `FileConflict.agentIds` receive a small warning marker beside their actor plate on the canvas, and `OrbPanel`'s `ไฟล์ชนกัน` tab displays a count badge (`2`).
2. **Inspecting conflicts**: User clicks `ลูกแก้ว` -> `ไฟล์ชนกัน`. Each conflict row shows the file path in monospace, repo badge, and clickable chips for each conflicting agent (`title` + state badge).
3. **Acting on a conflict**: Clicking an agent chip selects that character (opening `QuickReply` or `CommandPanel`) so the owner can press `Escape` or instruct the agent to pause/coordinate.
4. **Empty state**: When no files overlap, `ไฟล์ชนกัน` shows `ยังไม่พบไฟล์ที่ agent แก้ชนกัน`.
5. **Error state**: If `GET /api/conflicts` fails, shows `ตรวจไฟล์ชนกันไม่ได้` with a `ลองใหม่` button (canvas markers simply stay clear).
6. **Read-only (`local` source)**: Conflict detection and navigation work identically in read-only mode. Clicking an agent opens its panel where write controls still obey `caps.command` (`409 read_only_source`).

## Constraints

- One Bun process, no database, no extra polling interval, bounded per-session cache (max 50 paths per active session).
- No new npm dependencies.
- Keep files under 300 lines, no comments or docstrings in code.

## Acceptance criteria (QA in `bun run demo`)

- [ ] On demo load, `a1`, `a2`, and `a5` show the conflict warning marker next to their plate on the canvas.
- [ ] Clicking `ลูกแก้ว` opens `OrbPanel` with two tabs: `โหลด context` and `ไฟล์ชนกัน (2)`.
- [ ] Switching to `ไฟล์ชนกัน` lists `src/checkout/cart.ts` (`a1`, `a2`) and `src/checkout/summary.tsx` (`a1`, `a5`) under repo `web-app`.
- [ ] Clicking an agent chip inside a conflict row closes the orb popover and selects that agent.
- [ ] Unit tests cover path normalization (Windows backslashes, relative stripping), deduplication, exclusion of `done` agents, and empty/error states.
- [ ] `bun run check` passes cleanly.

## Out of scope

- Automatic merge conflict resolution or locking files via hooks.
- Diff comparison between two colliding agents.
- Historical conflict logs after agents leave the room.
