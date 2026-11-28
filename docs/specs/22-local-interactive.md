# Local Interactive Sessions

Date: 2026-11-28
Branch: `feat/22-local-interactive`

## Problem

Users running Isekai Office without Orca (Windows, Linux, or macOS local mode) are locked in read-only mode (`409 read_only_source`) and cannot spawn a session from the door or approve/reply to waiting agents from the room.

## Where it lives in the room

- **Door (`DoorPanel` -> `SpawnForm`)**: In `local` mode when `claude` CLI is available, `เรียกคนใหม่` becomes active. The Repo selector lists local project folders (discovered from recent `~/.claude/projects` `cwd`s plus `LOCAL_REPOS` env var). Submitting spawns a server-managed Claude Code session inside that folder.
- **Character (`CommandPanel`, `QuickReply`, `DecisionQueue`)**:
  - Sessions spawned from the room have `terminal: "managed:<id>"`, enabling `อนุญาต`, `ปฏิเสธ`, `CommandComposer`, `CompactButton`, and `Escape`.
  - External sessions started outside Isekai Office still appear in the room with `terminal: null` and keep the clear read-only notice (`session นี้เปิดจากข้างนอก ส่งคำสั่งจากที่นี่ไม่ได้`).
- **Hearth (`HearthPanel`)**: Displays managed session status (`คุมโดยห้อง X/4`) when running in local interactive mode.

No navbar and no settings page.

## Technical architecture (Cross-platform Bun + Claude Code CLI)

To stay in **one Bun process**, support **Windows, macOS, and Linux** without native PTY addons or new npm dependencies, and keep server memory near **16 MB**:

1. **Protocol (`server/managed/protocol.ts`)**: pure encoder/decoder for Claude Code CLI's structured stdio stream (`claude -p --input-format stream-json --output-format stream-json --verbose --permission-prompts host --session-id <uuid>`):
   - `encodeUserPrompt(text: string): string` -> JSON line `{"type":"user","message":{"role":"user","content":text}}\n`
   - `encodeControlResponse(requestId: string, allow: boolean, message?: string): string` -> JSON line `{"type":"control_response","response":{"subtype":"success","request_id":requestId,"response": allow ? {"behavior":"allow"} : {"behavior":"deny","message": message ?? "Denied from Isekai Office"}}}\n`
   - `encodeInterrupt(requestId: string): string` -> JSON line `{"type":"control_request","request_id":requestId,"request":{"subtype":"interrupt"}}\n`
   - `parseStreamLine(line: string)` -> typed union handling `assistant` (tool_use, text, usage tokens), `control_request` (permission prompt -> moves state to `waiting`, records `pendingRequestId`, formats tool name + input summary into screen lines), `result` (turn finished -> moves state to `done`), and `system` (`init` metadata).
2. **Runner (`server/managed/runner.ts`)**:
   - Hard cap: `MAX_MANAGED_SESSIONS = 4` (overridable via `MAX_MANAGED_SESSIONS` env, clamped 1..8). Spawning above the cap returns `429 { ok: false, error: 'too_many_sessions' }`.
   - Each managed session stores only:
     - child process handle (`Bun.Subprocess`), `id` (`managed-<uuid>`), `sessionId` (UUID), `title`, `repo`, `worktree` (selected folder path), `state`, `tool`, `lastMessage`, `contextTokens`, `updatedAt`, `activeAt`, `pendingRequestId`,
     - bounded screen ring buffer (max 40 lines, max 4 KB),
     - bounded session entries (max 200).
   - `spawn(request, repoPath)`: validates `repoPath` is one of the allowed discovered/configured local repos (never trusts arbitrary paths from request body!), starts the child process with `cwd: repoPath`, sends `request.prompt` immediately if provided, and emits the session into the room.
   - `sendCommand(managedId, command)`:
     - `prompt`: writes `encodeUserPrompt(command.text)` to stdin, transitions state to `working`.
     - `allow` / `deny`: requires a `pendingRequestId`; writes `encodeControlResponse`, clears pending request, transitions state to `working`. If no pending request exists, returns `{ ok: false, error: 'no_pending_prompt' }`.
     - `escape`: writes `encodeInterrupt` (and if process is stuck/exiting, terminates cleanly).
   - Cleanup: removes closed process handles on exit (keeping the finished session visible as `done` with `terminal: null` for `LOCAL_RECENT_MINUTES`, freeing the active process slot immediately) and registers `SIGINT`/`SIGTERM` cleanup so no orphan processes linger.
3. **Local Repos (`server/managed/repos.ts`)**:
   - Lists local repos from `LOCAL_REPOS` (comma/semicolon-separated paths, validated as existing directories) merged with unique existing `cwd` directories found in recent `~/.claude/projects` transcripts (capped at 20), returning `OrcaRepo[]` (`{ id: path, name: basename(path) }`).
4. **Source integration (`server/sources/local.ts` & `server/main.ts`)**:
   - Detects `claude` binary once at startup (`Bun.which('claude') !== null`) unless `LOCAL_INTERACTIVE=0`.
   - When interactive is enabled in `local` mode:
     - `caps` is `{ command: true, spawn: true, screen: true }`.
     - `listAgents()` merges managed sessions with discovered external sessions (deduplicating by `sessionId`, managed takes precedence so it keeps `terminal: "managed:<id>"`).
     - `readSession(id)` returns managed session entries + screen buffer when managed, else falls back to transcript file.
     - `GET /api/repos` uses `listLocalRepos()` when `activeSource.id === 'local'`.
     - `POST /api/spawn` uses `managedRunner.spawn()` when `activeSource.id === 'local'`.
     - `POST /api/command` routes `terminal.startsWith('managed:')` to `managedRunner.sendCommand()`, while external local sessions (`terminal === null`) return `409 { ok: false, error: 'read_only_source' }`.
   - When `claude` is unavailable or `LOCAL_INTERACTIVE=0`: `caps` stays `{ command: false, spawn: false, screen: false }` and every write endpoint still returns `409 read_only_source` identically to today.
5. **Demo mode (`server/feeds/demo.ts`)**:
   - `demoSpawn(request)` adds a real interactive demo agent (`managed-demo-N`) to the demo snapshot in `waiting` state with a sample permission prompt and terminal screen, notifies subscribers immediately, and responds to `demoCommand` (`allow` -> moves to `working`, `deny` -> moves to `done`, `prompt` -> appends user + assistant reply, `escape` -> moves to `done`).
   - Enforces the same 4-managed-session cap in demo mode (`429 too_many_sessions`) while keeping `a8` (`terminal: null`) read-only so QA can test every state in `bun run demo`.

## User flow and states

1. **Spawning locally**: User opens `ประตู` -> `เรียกคนใหม่`, selects a local repo folder, enters a session name (e.g. `fix-auth`) and optional first prompt, and clicks `เรียกเข้ามา`.
2. **Active managed character**: Within one tick the character walks into the room. When it asks for permission, `!` appears above its head and clicking it opens `QuickReply` with the tool/command screen lines and working `อนุญาต` / `ปฏิเสธ` buttons.
3. **External session (read-only)**: Clicking an external session (`terminal: null`, like `a8` in demo mode) shows `session นี้เปิดจากข้างนอก ส่งคำสั่งจากที่นี่ไม่ได้` and keeps buttons disabled.
4. **Cap reached**: Trying to spawn a 5th concurrent managed session shows `เปิด session พร้อมกันครบ 4 ตัวแล้ว ปิดตัวเก่าก่อน` (`429 too_many_sessions`).
5. **Unavailable / Disabled (`LOCAL_INTERACTIVE=0` or no `claude` CLI)**: `SpawnForm` shows `READ_ONLY_REASON`, and API returns `409 read_only_source`.
6. **Error / Process exit**: If a managed child exits unexpectedly, the error line is appended to its screen buffer, state becomes `done`, `terminal` becomes `null`, and its process slot is released.
7. **Empty repos**: If no local project folders are found, `SpawnForm` displays `ยังไม่พบโฟลเดอร์โปรเจกต์ ตั้งค่า LOCAL_REPOS หรือเปิด Claude Code ในโปรเจกต์ก่อน`.

## Constraints

- One Bun process, no database, no native PTY packages, no new npm dependencies.
- Hard cap of 4 concurrent managed child processes, bounded 40-line screen buffer per session.
- `server/guard.ts` local-origin checks stay unchanged.
- Keep all files under 300 lines, no comments or docstrings in code.

## Acceptance criteria (QA in `bun run demo`)

- [ ] Opening `ประตู` -> `เรียกคนใหม่`, entering name `fix-login` and prompt `check auth`, and clicking `เรียกเข้ามา` spawns a new character into the demo room without reloading.
- [ ] Clicking the newly spawned character opens `QuickReply` showing the permission prompt screen; clicking `อนุญาต` transitions it to `working`.
- [ ] Opening the spawned character's full `CommandPanel`, typing a prompt, and sending appends the message to the transcript.
- [ ] Clicking `a8` (`Write API changelog`, `terminal: null`) still displays the read-only note and disables decision/composer controls.
- [ ] Spawning 4 managed sessions succeeds; attempting a 5th shows the Thai cap error (`ครบ 4 ตัวแล้ว`).
- [ ] Unit tests cover stream-json protocol encode/decode, permission allow/deny/interrupt transitions, 4-session cap, repo path allowlist validation, deduplication between managed and external sessions, and `409 read_only_source` fallback when disabled.
- [ ] `bun run check` passes cleanly.

## Out of scope

- Attaching to or taking over external terminals started outside Isekai Office.
- Creating git worktrees automatically in local mode without Orca.
- Supporting non-Claude CLIs (Codex/Gemini/OpenCode) in this PR.
