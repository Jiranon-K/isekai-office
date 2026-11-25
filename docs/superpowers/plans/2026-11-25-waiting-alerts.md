# Waiting Alerts and Quick Reply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner is told when an agent starts waiting, and answers allow or deny from a popover on the character after seeing the terminal lines.

**Architecture:** Web only. Pure decisions (who started waiting, what the alert says, the tab title, whether to alert, which view to open) live in `web/src/notify/notify-logic.ts` with tests. Two hooks wrap the browser APIs (`Notification`, `localStorage`, `document.title`). The quick reply is a Radix popover anchored to a virtual element whose rectangle the canvas engine reports for the selected agent.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind 4, radix-ui Popover, Bun test runner.

**Spec:** `docs/superpowers/specs/2026-11-25-waiting-alerts-design.md`

## Global Constraints

- Work in `/Users/jiranon/Home/personal/isekai-office`. Run commands as `bash -c 'cd /Users/jiranon/Home/personal/isekai-office && <command>'` (a bare `cd` can hang in this shell).
- No server change and no new endpoint. Use the office feed, `/api/session/:id` and `/api/command` as they are.
- No comments in code, in any file, tests included.
- Small functions, early returns, files under 300 lines.
- No semicolons, single quotes, 2-space indent, no trailing commas in multi-line literals (match the files around you).
- UI text is Thai, exactly as written in this plan.
- An agent "needs the owner" when `needsDecision(agent.state)` from `web/src/panel/panel-logic.ts` is true.
- Never send `allow` or `deny` to one of the owner's live sessions while testing.
- Never touch `.env` files and never delete files.
- Commit steps run only after the owner has said commits are allowed for this plan. Never push. Do not reinstall the launchd service.
- Commit messages are English and end with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- The full check is `bun run check` (typecheck, tests, build). It must pass at the end of every task.

## File Structure

| File | Responsibility |
|---|---|
| `web/src/notify/notify-logic.ts` (new) | Pure decisions for alerts and for choosing quick reply or full panel |
| `web/src/notify/notify-logic.test.ts` (new) | Tests for the above |
| `web/src/notify/use-alert-setting.ts` (new) | The stored on/off switch and the permission request |
| `web/src/notify/use-waiting-alerts.ts` (new) | Sets the tab title and fires notifications |
| `web/src/components/icons.tsx` | Two bell icons |
| `web/src/hotspots/ThemeDock.tsx` | Bell button |
| `web/src/office/office-hotspots.ts` (+ test) | `agentHitRect`, the rectangle of a character |
| `web/src/office/office-engine.ts` | `agentRect(id)` on the engine API |
| `web/src/office/use-office-canvas.ts`, `OfficeCanvas.tsx` | Publish an `AgentLocator` through a ref |
| `web/src/panel/QuickReply.tsx` (new) | The popover |
| `web/src/App.tsx` | Wires alerts and chooses the view |

---

### Task 1: Alert decisions as pure functions

**Files:**
- Create: `web/src/notify/notify-logic.ts`
- Test: `web/src/notify/notify-logic.test.ts`

**Interfaces:**
- Consumes: `needsDecision(state: AgentState): boolean` from `@/panel/panel-logic`; `OfficeAgent` from `@shared/types`.
- Produces:
  - `APP_TITLE: string`
  - `ALERTS_KEY: string`
  - `type AlertText = { title: string; body: string }`
  - `type ReplyMode = 'quick' | 'full'`
  - `newlyWaiting(previous: readonly OfficeAgent[] | null, current: readonly OfficeAgent[]): OfficeAgent[]`
  - `alertText(agent: OfficeAgent): AlertText`
  - `tabTitle(count: number): string`
  - `canAlert(enabled: boolean, permission: string, visibility: string): boolean`
  - `storedEnabled(stored: string | null, permission: string): boolean`
  - `replyMode(agent: OfficeAgent, expanded: boolean): ReplyMode`

- [ ] **Step 1: Write the failing test**

Create `web/src/notify/notify-logic.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import type { AgentState, OfficeAgent } from '@shared/types'
import { alertText, canAlert, newlyWaiting, replyMode, storedEnabled, tabTitle } from './notify-logic'

function agent(id: string, state: AgentState, lastMessage: string | null = null): OfficeAgent {
  return {
    id,
    title: `session ${id}`,
    repo: null,
    workspace: null,
    worktree: null,
    session: null,
    contextTokens: null,
    state,
    tool: null,
    lastMessage,
    updatedAt: 0,
    terminal: null
  }
}

function ids(agents: OfficeAgent[]): string[] {
  return agents.map((found) => found.id)
}

describe('newly waiting agents', () => {
  test('an agent that goes from working to waiting is new', () => {
    expect(ids(newlyWaiting([agent('a', 'working')], [agent('a', 'waiting')]))).toEqual(['a'])
  })

  test('an agent that was already waiting is not new', () => {
    expect(newlyWaiting([agent('a', 'waiting')], [agent('a', 'blocked')])).toEqual([])
  })

  test('an agent that arrives already blocked is new', () => {
    expect(ids(newlyWaiting([agent('a', 'working')], [agent('a', 'working'), agent('b', 'blocked')]))).toEqual(['b'])
  })

  test('an agent that disappears is not new', () => {
    expect(newlyWaiting([agent('a', 'waiting')], [])).toEqual([])
  })

  test('the first snapshot is only a baseline', () => {
    expect(newlyWaiting(null, [agent('a', 'waiting')])).toEqual([])
  })
})

describe('alert text', () => {
  test('uses the title and the first non-empty line of the last message', () => {
    expect(alertText(agent('a', 'waiting', '\n\n  Allow Bash?  \nmore'))).toEqual({ title: 'session a', body: 'Allow Bash?' })
  })

  test('cuts the body at 120 characters', () => {
    expect(alertText(agent('a', 'waiting', 'x'.repeat(300))).body).toHaveLength(120)
  })

  test('falls back to the state when there is no message', () => {
    expect(alertText(agent('a', 'waiting')).body).toBe('รอคุณตัดสินใจ')
    expect(alertText(agent('a', 'blocked', '   ')).body).toBe('ติดอยู่ ต้องการคุณ')
  })
})

describe('tab title', () => {
  test('shows the count only when someone waits', () => {
    expect(tabTitle(0)).toBe('Isekai Office')
    expect(tabTitle(2)).toBe('(2) Isekai Office')
  })
})

describe('whether to alert', () => {
  test('only when switched on, permitted and the tab is hidden', () => {
    expect(canAlert(true, 'granted', 'hidden')).toBe(true)
    expect(canAlert(false, 'granted', 'hidden')).toBe(false)
    expect(canAlert(true, 'denied', 'hidden')).toBe(false)
    expect(canAlert(true, 'default', 'hidden')).toBe(false)
    expect(canAlert(true, 'granted', 'visible')).toBe(false)
  })

  test('the stored switch counts only while the browser still permits it', () => {
    expect(storedEnabled('1', 'granted')).toBe(true)
    expect(storedEnabled('1', 'denied')).toBe(false)
    expect(storedEnabled(null, 'granted')).toBe(false)
  })
})

describe('reply mode', () => {
  test('a waiting agent opens the quick reply until it is expanded', () => {
    expect(replyMode(agent('a', 'waiting'), false)).toBe('quick')
    expect(replyMode(agent('a', 'blocked'), false)).toBe('quick')
    expect(replyMode(agent('a', 'waiting'), true)).toBe('full')
  })

  test('an agent that does not wait opens the full panel', () => {
    expect(replyMode(agent('a', 'working'), false)).toBe('full')
    expect(replyMode(agent('a', 'done'), false)).toBe('full')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bash -c 'cd /Users/jiranon/Home/personal/isekai-office && bun test web/src/notify'`
Expected: FAIL, cannot find module `./notify-logic`.

- [ ] **Step 3: Write the implementation**

Create `web/src/notify/notify-logic.ts`:

```ts
import type { OfficeAgent } from '@shared/types'
import { needsDecision } from '@/panel/panel-logic'

export const APP_TITLE = 'Isekai Office'
export const ALERTS_KEY = 'isekai-office-alerts'
const BODY_LIMIT = 120
const WAITING_BODY = 'รอคุณตัดสินใจ'
const BLOCKED_BODY = 'ติดอยู่ ต้องการคุณ'

export type AlertText = { title: string; body: string }

export type ReplyMode = 'quick' | 'full'

export function newlyWaiting(previous: readonly OfficeAgent[] | null, current: readonly OfficeAgent[]): OfficeAgent[] {
  if (previous === null) {
    return []
  }
  const waitingBefore = new Set(previous.filter((agent) => needsDecision(agent.state)).map((agent) => agent.id))
  return current.filter((agent) => needsDecision(agent.state) && !waitingBefore.has(agent.id))
}

function firstLine(message: string | null): string | null {
  const line = (message ?? '')
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part !== '')
  return line ?? null
}

export function alertText(agent: OfficeAgent): AlertText {
  const fallback = agent.state === 'blocked' ? BLOCKED_BODY : WAITING_BODY
  const body = (firstLine(agent.lastMessage) ?? fallback).slice(0, BODY_LIMIT)
  return { title: agent.title, body }
}

export function tabTitle(count: number): string {
  return count > 0 ? `(${count}) ${APP_TITLE}` : APP_TITLE
}

export function canAlert(enabled: boolean, permission: string, visibility: string): boolean {
  return enabled && permission === 'granted' && visibility === 'hidden'
}

export function storedEnabled(stored: string | null, permission: string): boolean {
  return stored === '1' && permission === 'granted'
}

export function replyMode(agent: OfficeAgent, expanded: boolean): ReplyMode {
  return needsDecision(agent.state) && !expanded ? 'quick' : 'full'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bash -c 'cd /Users/jiranon/Home/personal/isekai-office && bun test web/src/notify'`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git -C /Users/jiranon/Home/personal/isekai-office add web/src/notify
git -C /Users/jiranon/Home/personal/isekai-office commit -m "feat: decide who started waiting and what the alert says"
```

---

### Task 2: Tab title and notifications

**Files:**
- Create: `web/src/notify/use-alert-setting.ts`
- Create: `web/src/notify/use-waiting-alerts.ts`
- Modify: `web/src/components/icons.tsx`
- Modify: `web/src/hotspots/ThemeDock.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes from Task 1: `ALERTS_KEY`, `alertText`, `canAlert`, `newlyWaiting`, `storedEnabled`, `tabTitle`. From the repo: `countAgents(agents: OfficeAgent[]): { needsYou: number }` in `@/hud/hud-counts`.
- Produces:
  - `type AlertSetting = { supported: boolean; enabled: boolean; denied: boolean; toggle(): void }`
  - `useAlertSetting(): AlertSetting`
  - `useWaitingAlerts(agents: readonly OfficeAgent[] | null, enabled: boolean, onOpen: (agentId: string) => void): void`
  - `ThemeDock` gains the prop `alerts: AlertSetting`
  - icons `AlertsOnIcon`, `AlertsOffIcon`

- [ ] **Step 1: Add the icons**

In `web/src/components/icons.tsx`, add `Notification01Icon` and `NotificationBlock01Icon` to the alphabetical import list from `@hugeicons/core-free-icons` (between `Moon02Icon` and `Robot01Icon`), and add these two exports after the `MoonIcon` export:

```ts
export const AlertsOnIcon = makeIcon(Notification01Icon)
export const AlertsOffIcon = makeIcon(NotificationBlock01Icon)
```

- [ ] **Step 2: Write the setting hook**

Create `web/src/notify/use-alert-setting.ts`:

```ts
import { useCallback, useState } from 'react'
import { ALERTS_KEY, storedEnabled } from './notify-logic'

export type AlertSetting = { supported: boolean; enabled: boolean; denied: boolean; toggle(): void }

function isSupported(): boolean {
  return typeof Notification !== 'undefined'
}

function readEnabled(): boolean {
  return isSupported() && storedEnabled(localStorage.getItem(ALERTS_KEY), Notification.permission)
}

async function askPermission(): Promise<boolean> {
  return (await Notification.requestPermission()) === 'granted'
}

export function useAlertSetting(): AlertSetting {
  const [enabled, setEnabled] = useState(readEnabled)
  const [denied, setDenied] = useState(false)

  const switchOn = useCallback(async () => {
    const allowed = await askPermission()
    setDenied(!allowed)
    if (!allowed) {
      return
    }
    localStorage.setItem(ALERTS_KEY, '1')
    setEnabled(true)
  }, [])

  const toggle = useCallback(() => {
    if (enabled) {
      localStorage.removeItem(ALERTS_KEY)
      setEnabled(false)
      return
    }
    void switchOn()
  }, [enabled, switchOn])

  return { supported: isSupported(), enabled, denied, toggle }
}
```

- [ ] **Step 3: Write the alerts hook**

Create `web/src/notify/use-waiting-alerts.ts`:

```ts
import type { OfficeAgent } from '@shared/types'
import { useEffect, useRef } from 'react'
import { countAgents } from '@/hud/hud-counts'
import { alertText, canAlert, newlyWaiting, tabTitle } from './notify-logic'

function permission(): string {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

function notify(agent: OfficeAgent, onOpen: (agentId: string) => void): void {
  const text = alertText(agent)
  const notification = new Notification(text.title, { body: text.body, tag: agent.id })
  notification.onclick = () => {
    window.focus()
    onOpen(agent.id)
    notification.close()
  }
}

export function useWaitingAlerts(agents: readonly OfficeAgent[] | null, enabled: boolean, onOpen: (agentId: string) => void): void {
  const previous = useRef<readonly OfficeAgent[] | null>(null)
  const needsYou = countAgents([...(agents ?? [])]).needsYou

  useEffect(() => {
    document.title = tabTitle(needsYou)
  }, [needsYou])

  useEffect(() => {
    if (agents === null) {
      return
    }
    const fresh = newlyWaiting(previous.current, agents)
    previous.current = agents
    if (!canAlert(enabled, permission(), document.visibilityState)) {
      return
    }
    for (const agent of fresh) {
      notify(agent, onOpen)
    }
  }, [agents, enabled, onOpen])
}
```

- [ ] **Step 4: Add the bell to the dock**

In `web/src/hotspots/ThemeDock.tsx`:

Replace the first import line with:

```ts
import { AlertsOffIcon, AlertsOnIcon, MoonIcon, SunIcon } from '@/components/icons'
```

Add after the `WORLD_ICONS` import:

```ts
import type { AlertSetting } from '@/notify/use-alert-setting'
```

Replace the props type and add the button component above `ThemeDock`:

```tsx
type ThemeDockProps = { theme: Theme; onThemeChange(theme: Theme): void; alerts: AlertSetting }

const ALERTS_LABEL = 'แจ้งเตือนเมื่อ agent รอคุณ'
const ALERTS_DENIED = 'เบราว์เซอร์ไม่อนุญาตการแจ้งเตือน'

function AlertsButton({ alerts }: { alerts: AlertSetting }): React.JSX.Element | null {
  if (!alerts.supported) {
    return null
  }
  const hint = alerts.denied ? ALERTS_DENIED : ALERTS_LABEL
  return (
    <>
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      <Button
        variant={alerts.enabled ? 'default' : 'ghost'}
        size="icon-sm"
        aria-pressed={alerts.enabled}
        aria-label={ALERTS_LABEL}
        aria-description={alerts.denied ? ALERTS_DENIED : undefined}
        title={hint}
        onClick={alerts.toggle}
      >
        {alerts.enabled ? <AlertsOnIcon /> : <AlertsOffIcon />}
      </Button>
    </>
  )
}
```

Change the component signature to `export function ThemeDock({ theme, onThemeChange, alerts }: ThemeDockProps)`, change the toolbar's `aria-label` to `เปลี่ยนโลก สลับกลางวันกลางคืน และการแจ้งเตือน`, and render `<AlertsButton alerts={alerts} />` directly after the day and night `<Button>`, before the closing `</div>`.

- [ ] **Step 5: Wire the app**

In `web/src/App.tsx`:

Add imports (keep the list alphabetical by path):

```ts
import { useAlertSetting } from '@/notify/use-alert-setting'
import { useWaitingAlerts } from '@/notify/use-waiting-alerts'
```

Inside `App`, after the `pickAgent` line, add:

```ts
  const alerts = useAlertSetting()
  useWaitingAlerts(office.data?.agents ?? null, alerts.enabled, pickAgent)
```

Change the dock line to:

```tsx
      {boardOpen ? null : <ThemeDock theme={theme} onThemeChange={setTheme} alerts={alerts} />}
```

- [ ] **Step 6: Run the full check**

Run: `bash -c 'cd /Users/jiranon/Home/personal/isekai-office && bun run check'`
Expected: typecheck clean, all tests pass, build succeeds.

- [ ] **Step 7: Verify in the browser**

With `bun run dev` running, open `http://localhost:4300`.
- The tab title is `(N) Isekai Office` where N equals the needs-you count in the reception panel, or `Isekai Office` when it is 0.
- The dock at the bottom left shows a bell. Click it: the browser asks for permission. Allow: the bell turns filled and `localStorage.getItem('isekai-office-alerts')` is `'1'`. Reload: the bell is still on.
- In the page console run `new Notification('test', { body: 'body', tag: 'x' })` to confirm the browser shows notifications from this origin.

- [ ] **Step 8: Commit**

```bash
git -C /Users/jiranon/Home/personal/isekai-office add web/src/notify web/src/components/icons.tsx web/src/hotspots/ThemeDock.tsx web/src/App.tsx
git -C /Users/jiranon/Home/personal/isekai-office commit -m "feat: count waiting agents in the tab title and notify when one starts waiting"
```

---

### Task 3: Report where a character is on screen

**Files:**
- Modify: `web/src/office/office-hotspots.ts`
- Test: `web/src/office/office-hotspots.test.ts`
- Modify: `web/src/office/office-engine.ts`
- Modify: `web/src/office/use-office-canvas.ts`
- Modify: `web/src/office/OfficeCanvas.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `RoomRect` from `office-hotspots.ts`; `computeView`, `toScreenBox` from `office-view.ts`.
- Produces:
  - `AGENT_HALF_WIDTH: number`, `AGENT_HEIGHT: number`, `agentHitRect(x: number, y: number): RoomRect` in `office-hotspots.ts`
  - `agentRect: (id: string) => RoomRect | null` on `OfficeEngine`
  - `type AgentLocator = (agentId: string) => DOMRect | null` exported from `use-office-canvas.ts`
  - `OfficeCanvas` gains the prop `locateRef: React.RefObject<AgentLocator | null>`

- [ ] **Step 1: Write the failing test**

In `web/src/office/office-hotspots.test.ts`, add `AGENT_HALF_WIDTH`, `AGENT_HEIGHT` and `agentHitRect` to the import from `./office-hotspots`, and append:

```ts
describe('agent hit rect', () => {
  test('is centred on the feet and reaches up over the body', () => {
    expect(agentHitRect(100, 200)).toEqual({
      x: 100 - AGENT_HALF_WIDTH,
      y: 200 - AGENT_HEIGHT,
      width: AGENT_HALF_WIDTH * 2,
      height: AGENT_HEIGHT
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bash -c 'cd /Users/jiranon/Home/personal/isekai-office && bun test web/src/office/office-hotspots.test.ts'`
Expected: FAIL, `agentHitRect` is not exported.

- [ ] **Step 3: Add the rect to the hotspot module**

In `web/src/office/office-hotspots.ts`, add after the `REST_ALPHA` line:

```ts
export const AGENT_HALF_WIDTH = 9
export const AGENT_HEIGHT = 26
```

and add after the `contains` function:

```ts
export function agentHitRect(x: number, y: number): RoomRect {
  return { x: x - AGENT_HALF_WIDTH, y: y - AGENT_HEIGHT, width: AGENT_HALF_WIDTH * 2, height: AGENT_HEIGHT }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bash -c 'cd /Users/jiranon/Home/personal/isekai-office && bun test web/src/office/office-hotspots.test.ts'`
Expected: PASS.

- [ ] **Step 5: Expose the rect from the engine**

In `web/src/office/office-engine.ts`:

Change the hotspot import to:

```ts
import {
  AGENT_HALF_WIDTH,
  AGENT_HEIGHT,
  PULSE_MS,
  agentHitRect,
  pulseAlpha,
  resolvePick,
  type HotspotId,
  type PickTarget,
  type RoomRect
} from './office-hotspots'
```

Delete the two lines `const HIT_HALF_WIDTH = 9` and `const HIT_HEIGHT = 26`. In `actorAt`, replace `HIT_HALF_WIDTH` with `AGENT_HALF_WIDTH` and `HIT_HEIGHT` with `AGENT_HEIGHT`.

Add to the `OfficeEngine` type, after `pick`:

```ts
  agentRect: (id: string) => RoomRect | null
```

Add after the `pick` function:

```ts
  function agentRect(id: string): RoomRect | null {
    const actor = [...actors.values()].find((candidate) => candidate.kind === 'agent' && candidate.id === id)
    return actor ? agentHitRect(actor.x, actor.y) : null
  }
```

Change the return line to:

```ts
  return { update, resize, pick, agentRect, setHover, setReveal, pulse, destroy }
```

- [ ] **Step 6: Publish a locator from the canvas hook**

In `web/src/office/use-office-canvas.ts`:

Add below the `SEEN_KEY` line:

```ts
export type AgentLocator = (agentId: string) => DOMRect | null
```

Change `CanvasHandlers` to:

```ts
type CanvasHandlers = {
  onSelect: (id: string | null) => void
  onHotspot: (id: HotspotId) => void
  locateRef: React.RefObject<AgentLocator | null>
}
```

Add after `revealHotspot`:

```ts
function locateAgent(canvas: HTMLCanvasElement, engine: OfficeEngine, agentId: string): DOMRect | null {
  const rect = engine.agentRect(agentId)
  if (!rect) {
    return null
  }
  const bounds = canvas.getBoundingClientRect()
  const box = toScreenBox(computeView(bounds.width, bounds.height, 1), rect)
  return new DOMRect(bounds.left + box.left, bounds.top + box.top, box.width, box.height)
}
```

Change the hook signature to:

```ts
export function useOfficeCanvas(input: OfficeInput, { onSelect, onHotspot, locateRef }: CanvasHandlers) {
```

In the effect that creates the engine, add after `engineRef.current = engine`:

```ts
    locateRef.current = (agentId) => locateAgent(canvas, engine, agentId)
```

and in its cleanup, before `engineRef.current = null`:

```ts
      locateRef.current = null
```

Change that effect's dependency array from `[]` to `[locateRef]`.

- [ ] **Step 7: Pass the ref through the canvas component**

In `web/src/office/OfficeCanvas.tsx`:

Change the hook import to:

```ts
import { useOfficeCanvas, type AgentLocator } from './use-office-canvas'
```

Add to `OfficeCanvasProps`:

```ts
  locateRef: React.RefObject<AgentLocator | null>
```

Change the two lines at the top of the component to:

```tsx
  const { agents, selectedId, onSelect, onHotspot, openHotspot, mode, locateRef } = props
  const { containerRef, canvasRef, handleClick, handlePointerMove, handlePointerLeave, highlight } = useOfficeCanvas(props, { onSelect, onHotspot, locateRef })
```

- [ ] **Step 8: Create the ref in the app**

In `web/src/App.tsx`, change the React import to:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
```

add the import:

```ts
import type { AgentLocator } from '@/office/use-office-canvas'
```

add inside `App` after the `alerts` lines:

```ts
  const locateRef = useRef<AgentLocator | null>(null)
```

and add the prop `locateRef={locateRef}` to `<OfficeCanvas>`.

- [ ] **Step 9: Run the full check**

Run: `bash -c 'cd /Users/jiranon/Home/personal/isekai-office && bun run check'`
Expected: typecheck clean, all tests pass, build succeeds.

- [ ] **Step 10: Commit**

```bash
git -C /Users/jiranon/Home/personal/isekai-office add web/src/office web/src/App.tsx
git -C /Users/jiranon/Home/personal/isekai-office commit -m "feat: the canvas reports where a character is on screen"
```

---

### Task 4: Quick reply popover

**Files:**
- Create: `web/src/panel/QuickReply.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `replyMode` (Task 1); `AgentLocator` and `locateRef` (Task 3); from the repo `useSession(agent)`, `useCommand(agentId)`, `lastScreenLines(screen, limit)`, `STATE_LABELS`, `Popover`, `PopoverAnchor`, `PopoverContent`, `PopoverHeader`, `PopoverTitle`, `PopoverDescription` in `@/components/ui/popover`, `Badge`, `Button`, `Skeleton`, `AllowIcon`, `DenyIcon`.
- Produces: `QuickReply({ agent, locateRef, onExpand, onClose })`.

- [ ] **Step 1: Write the popover**

Create `web/src/panel/QuickReply.tsx`:

```tsx
import type { OfficeAgent, SessionDetail } from '@shared/types'
import { useMemo } from 'react'
import { Badge } from '@/components/badge'
import { AllowIcon, DenyIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import type { Loadable } from '@/lib/api'
import type { AgentLocator } from '@/office/use-office-canvas'
import { lastScreenLines, STATE_LABELS } from './panel-logic'
import { useCommand, type CommandStatus } from './use-command'
import { useSession } from './use-session'

type QuickReplyProps = {
  agent: OfficeAgent
  locateRef: React.RefObject<AgentLocator | null>
  onExpand(): void
  onClose(): void
}

const SCREEN_LINES = 6

function centreRect(): DOMRect {
  return new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0)
}

function ScreenLines({ session }: { session: Loadable<SessionDetail> }): React.JSX.Element {
  if (!session.data && session.loading) {
    return <Skeleton className="h-24 w-full" />
  }
  const screen = session.data?.screen
  if (!screen) {
    return <p className="rounded-md bg-muted p-2 text-small text-muted-foreground">อ่านหน้าจอ terminal ไม่ได้</p>
  }
  return (
    <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-caption whitespace-pre-wrap">
      {lastScreenLines(screen, SCREEN_LINES)}
    </pre>
  )
}

function Decision({ status, onAllow, onDeny }: { status: CommandStatus; onAllow(): void; onDeny(): void }): React.JSX.Element {
  const sending = status.kind === 'sending'
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button className="flex-1" disabled={sending} onClick={onAllow}>
          <AllowIcon />
          อนุญาต
        </Button>
        <Button variant="outline" className="flex-1" disabled={sending} onClick={onDeny}>
          <DenyIcon />
          ปฏิเสธ
        </Button>
      </div>
      {status.kind === 'failed' ? (
        <p role="alert" className="text-caption text-tint-red-fg">
          ส่งไม่สำเร็จ ({status.reason}) ลองใหม่อีกครั้ง
        </p>
      ) : null}
    </div>
  )
}

export function QuickReply({ agent, locateRef, onExpand, onClose }: QuickReplyProps): React.JSX.Element {
  const session = useSession(agent)
  const command = useCommand(agent.id)
  const anchor = useMemo(
    () => ({ current: { getBoundingClientRect: () => locateRef.current?.(agent.id) ?? centreRect() } }),
    [agent.id, locateRef]
  )
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent
        side="top"
        sideOffset={8}
        collisionPadding={12}
        updatePositionStrategy="always"
        aria-label={`ตอบ ${agent.title}`}
        className="flex w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-3"
      >
        <PopoverHeader>
          <PopoverTitle className="truncate text-body-strong">{agent.title}</PopoverTitle>
          <PopoverDescription asChild>
            <div>
              <Badge variant="amber">{STATE_LABELS[agent.state]}</Badge>
            </div>
          </PopoverDescription>
        </PopoverHeader>
        <ScreenLines session={session} />
        {agent.terminal === null ? (
          <p role="note" className="rounded-md bg-muted p-2 text-small text-muted-foreground">
            session นี้ไม่มี terminal ที่เขียนได้ ตอบจากที่นี่ไม่ได้
          </p>
        ) : (
          <Decision status={command.status} onAllow={() => void command.run('allow')} onDeny={() => void command.run('deny')} />
        )}
        <Button variant="ghost" size="sm" onClick={onExpand}>
          เปิดแผงเต็ม
        </Button>
      </PopoverContent>
    </Popover>
  )
}
```

If typecheck rejects `asChild` on `PopoverDescription` (the wrapper in `web/src/components/ui/popover.tsx` may render a plain element), replace the `PopoverDescription` block with:

```tsx
          <div>
            <Badge variant="amber">{STATE_LABELS[agent.state]}</Badge>
          </div>
```

and drop `PopoverDescription` from the import.

- [ ] **Step 2: Choose the view in the app**

In `web/src/App.tsx`:

Add imports:

```ts
import { replyMode } from '@/notify/notify-logic'
import { QuickReply } from '@/panel/QuickReply'
```

Inside `App`, after the `selected` line, add:

```ts
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const showQuickReply = selected !== null && replyMode(selected, expandedId === selected.id) === 'quick'
```

`expandedId` holds the id of the agent whose full panel the owner asked for, so selecting another agent resets it without an effect.

Replace the last child of the root `<div>` (the `CommandPanel` line) with:

```tsx
      {selected && showQuickReply ? (
        <QuickReply agent={selected} locateRef={locateRef} onExpand={() => setExpandedId(selected.id)} onClose={() => pickAgent(null)} />
      ) : null}
      {selected && !showQuickReply ? <CommandPanel agent={selected} contextWindow={contextWindow} onClose={() => pickAgent(null)} /> : null}
```

- [ ] **Step 3: Run the full check**

Run: `bash -c 'cd /Users/jiranon/Home/personal/isekai-office && bun run check'`
Expected: typecheck clean, all tests pass, build succeeds. `web/src/App.tsx` stays under 300 lines.

- [ ] **Step 4: Verify in the browser**

With `bun run dev` running at `http://localhost:4300`:
- Click a character whose state is working or done: the full command panel opens on the right, as before.
- Start a throwaway session for the test (for example a new Claude Code session in a scratch folder under Orca that asks for a tool permission). When it waits, click its character: the popover opens above the character with the last terminal lines, `อนุญาต`, `ปฏิเสธ` and `เปิดแผงเต็ม`.
- Scroll the room: the popover stays on the character.
- Click `เปิดแผงเต็ม`: the popover closes and the full panel opens for the same agent.
- Press Escape with the popover open: it closes and the URL loses `?agent=`.
- On the throwaway session only, click `อนุญาต`: within a few seconds its state leaves waiting and the full panel replaces the popover.
- Put the tab in the background with the bell on, make the throwaway session wait again: one notification appears, and clicking it focuses the tab with the popover open on that agent.

Never click `อนุญาต` or `ปฏิเสธ` on a session that is not the throwaway one.

- [ ] **Step 5: Commit**

```bash
git -C /Users/jiranon/Home/personal/isekai-office add web/src/panel/QuickReply.tsx web/src/App.tsx
git -C /Users/jiranon/Home/personal/isekai-office commit -m "feat: answer a waiting agent from a popover on its character"
```

---

## Self-review notes

- Spec coverage: alert rule and baseline (Task 1 `newlyWaiting`, Task 2 hook), notification text, tag and click (Tasks 1 and 2), tab title (Task 2), switch, storage key, denied state and unsupported browsers (Task 2), quick reply opening rule (Task 1 `replyMode`, Task 4), contents, disabled state, error text, read-only sessions, Escape, following the character (Tasks 3 and 4).
- Escape: Radix closes the popover on Escape and calls `onOpenChange(false)`, which clears the selection. The canvas `onKeyDown` already clears it when focus is on the canvas.
- The popover follows the character because `updatePositionStrategy="always"` re-reads the virtual anchor's rectangle every animation frame.
- One deviation from the spec's code layout table: the character position is published through `use-office-canvas.ts` and a ref, and the engine only gains `agentRect`. `HotspotPopover` is not reused because it is tied to a `Hotspot`; `QuickReply` uses the same popover primitives directly.
