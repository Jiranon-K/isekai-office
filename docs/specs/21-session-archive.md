# Session Archive & Search

Date: 2026-11-28
Branch: `feat/21-session-archive`

## Problem

Once an agent session goes quiet past `LOCAL_RECENT_MINUTES` (60 minutes) and leaves the room, the owner cannot find or read its past transcript from Isekai Office, and the bookshelves (`ชั้นหนังสือ`) stay empty whenever no external task tracker is configured.

## Where it lives in the room

- **Bookshelves (`ArchivePanel`, `web/src/room-panels/ArchivePanel.tsx`)**: Convert into a two-tab panel:
  - `เซสชันเก่า` (default tab): searchable list of past sessions + inline read-only transcript viewer + `บันทึกเป็นแม่แบบ` / `คัดลอกคำสั่งแรก` action.
  - `ประวัติ Loop`: existing board loop history (`loopHistory(board.data)`).

No navbar and no settings page.

## Data shapes and API

Create `shared/archive.ts`:

```ts
export type ArchivedSession = {
  id: string
  title: string
  repo: string | null
  modifiedAt: number
  size: number
  active: boolean
}

export type ArchiveListResponse = {
  sessions: ArchivedSession[]
  total: number
  truncated: boolean
}
```

Server routes (`server/archive/routes.ts`, wired in `server/main.ts` after `isAllowedRequest`):

- `GET /api/archive?q=&repo=&limit=30`
  - On-demand scan of `~/.claude/projects/*/*.jsonl` (no background timer, no database).
  - Reads metadata (title + `cwd` -> `repo`) using `readTail` + `localFacts` with a bounded in-memory LRU cache (max 200 entries keyed by `path:mtimeMs:size` so memory stays flat near 16 MB).
  - Marks `active: true` for session IDs currently present in the live office snapshot.
  - Filters by `q` (case-insensitive substring match against `title` or `repo`) and exact `repo` when provided.
  - Sorts by `modifiedAt` descending and slices to `limit` (default 30, clamped to 1..50).
- `GET /api/archive/:id`
  - Validates `id` strictly (`/^[A-Za-z0-9._-]{1,128}$/`). Invalid ID returns `400 { error: 'bad_request' }`.
  - Resolves the file only from scanned files under `projectsDir` (zero path traversal). Unknown ID returns `404 { error: 'session_not_found' }`.
  - Reads entries with existing `historyAt(path)` and returns `SessionDetail` (`{ id, entries, screen: null }`).
- Demo feed (`server/archive/demo-archive.ts`):
  - Provides 5 realistic archived sessions across `web-app`, `api`, `infra`, and `docs` (with realistic `modifiedAt` timestamps from 2 hours ago to 2 days ago) and distinct transcripts with first user prompts, so search, repo filtering, transcript reading, and template saving can all be verified in `bun run demo`.

## User flow and states

1. User clicks `ชั้นหนังสือ`. `ArchivePanel` opens on the `เซสชันเก่า` tab and fetches `GET /api/archive`.
2. **Search & filter**: Top row has a search input (`ค้นหาชื่อ session หรือ repo`) and a repo dropdown (`ทุก repo` + discovered repos). Typing filters client-side or re-queries with debounce (200ms).
3. **List view**: Each row displays `title`, `repo` badge, relative time (e.g. `2 ชม. ที่แล้ว` / `เมื่อวาน`), and a subtle `อยู่ในห้อง` badge if `active: true`.
4. **Session detail view**: Clicking a row switches the panel body to a read-only transcript view with a `กลับ` button, session title, repo, and the reused `Transcript` component.
5. **Save as template / Copy first prompt**:
   - Finds the first `role === 'user'` entry in the transcript.
   - If found, shows two buttons: `คัดลอกคำสั่งแรก` (copies text to clipboard with `คัดลอกแล้ว` feedback) and `บันทึกเป็นแม่แบบ` (fetches current templates via `GET /api/templates`, appends a new template with slugged unique `id`, truncated `name` <= 40 chars, and the first prompt capped at `PROMPT_MAX`, saves via `PUT /api/templates`, and shows `บันทึกแม่แบบแล้ว` — or `แม่แบบเต็มแล้ว` if at `TEMPLATE_LIMIT`).
6. **Empty state**:
   - No archived sessions at all: `ยังไม่มีเซสชันเก่าในเครื่อง`.
   - Search yields no match: `ไม่พบเซสชันที่ตรงกับเงื่อนไข`.
7. **Error state**:
   - List fetch fails: `อ่านหอจดหมายเหตุไม่ได้` with a `ลองใหม่` button.
   - Transcript fetch fails: `อ่านประวัติแชทไม่ได้` with `กลับ` and `ลองใหม่` buttons.
8. **Read-only (`local` source)**: Fully supported. Viewing transcripts and saving templates (`PUT /api/templates`) do not depend on Orca and never hit `409 read_only_source`.
9. **Loop history tab**: Switching to `ประวัติ Loop` preserves existing `ArchivePanel` behavior identically.

## Constraints

- One Bun process, no database, bounded LRU metadata cache (max 200 entries), on-demand scan only.
- No new npm dependencies.
- Keep all files under 300 lines, no comments or docstrings in code.

## Acceptance criteria (QA in `bun run demo`)

- [ ] Clicking `ชั้นหนังสือ` opens `ArchivePanel` with tabs `เซสชันเก่า` and `ประวัติ Loop`.
- [ ] `เซสชันเก่า` lists 5 demo archived sessions with titles, repos, and timestamps.
- [ ] Typing `api` or selecting repo `api` narrows the list; typing `zzzz` shows `ไม่พบเซสชันที่ตรงกับเงื่อนไข`.
- [ ] Clicking an archived session displays its read-only transcript with `กลับ`, `คัดลอกคำสั่งแรก`, and `บันทึกเป็นแม่แบบ` buttons.
- [ ] Clicking `บันทึกเป็นแม่แบบ` shows `บันทึกแม่แบบแล้ว`, and opening `ประตู` -> `แม่แบบ` shows the newly saved template.
- [ ] Switching to `ประวัติ Loop` still displays the existing board loop history cards.
- [ ] `bun run check` passes cleanly and unit tests cover path-traversal rejection, LRU cap, search filtering, and template creation.

## Out of scope

- Full-text search inside transcript message bodies across all historical files.
- Deleting or editing historical transcript files.
- SQLite or background file indexing.
