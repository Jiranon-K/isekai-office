# Waiting alerts and quick reply

Date: 2026-11-25

## Problem

The owner runs several agent sessions at once and keeps the Isekai Office tab open in the background. An agent that needs a decision (`waiting` or `blocked`) sits idle until the owner happens to look at the tab. Answering then takes a click on the character and a read of the full command panel.

## Goal

1. The owner learns that an agent started waiting without looking at the tab.
2. The owner answers an allow or deny question from the room, after seeing what the agent asked.

## Out of scope

- Any server change or new endpoint. Everything uses the office feed, `/api/session/:id` and `/api/command` as they are.
- Notifications when the tab is closed (macOS notifications from the server).
- Sound.
- Sending a free-text prompt from the quick reply. The full command panel keeps that.

## Part 1: alerts

### When an alert fires

An agent "needs the owner" when `needsDecision(agent.state)` is true (`waiting` or `blocked`), the rule the command panel already uses.

An alert fires for an agent when both hold:

- the previous snapshot had that agent id in a state that did not need the owner, or did not have that agent at all, and the current snapshot has it in a state that does;
- `document.visibilityState` is `hidden`.

The first snapshot after page load never fires an alert. It only becomes the baseline.

### The notification

- Uses the browser `Notification` API.
- Title: the agent's `title`.
- Body: the first non-empty line of `agent.lastMessage`, cut to 120 characters. When there is no message: `รอคุณตัดสินใจ` for `waiting`, `ติดอยู่ ต้องการคุณ` for `blocked`.
- `tag`: the agent id, so a second alert for the same agent replaces the first.
- Click: `window.focus()`, select that agent (same as clicking the character), close the notification.

### Tab title

The document title is `(N) Isekai Office` when N agents need the owner and `Isekai Office` when none do. This always runs, with notifications on or off, tab visible or hidden.

### The switch

- A bell button in `ThemeDock` (bottom left), after the day and night toggle. `aria-pressed` reflects the state. Label: `แจ้งเตือนเมื่อ agent รอคุณ`.
- Default off. The choice is stored in `localStorage` under `isekai-office-alerts`.
- Turning it on calls `Notification.requestPermission()` from the click. If the result is not `granted`, the switch stays off and the dock shows `เบราว์เซอร์ไม่อนุญาตการแจ้งเตือน` as the button's title and accessible description.
- If `Notification` does not exist in the browser, the button is not rendered.
- Alerts fire only when the switch is on and `Notification.permission === 'granted'`.

## Part 2: quick reply

### Opening

Selecting an agent (click on the character, its screen-reader button, the arrow keys, `?agent=<id>`, or a notification click) opens:

- the **quick reply** popover when the agent needs the owner;
- the full command panel otherwise, as today.

The route does not change: both are `?agent=<id>`. Which one shows is derived from the agent's state plus one piece of local state, `expanded`, which is reset whenever the selected agent id changes.

### Contents

A popover anchored to the character's screen position, in the same style as the hotspot popovers:

- the agent title and its state badge;
- the last 6 lines of the terminal screen from `/api/session/:id` (`screen`), in a monospace block; a skeleton while loading; `อ่านหน้าจอ terminal ไม่ได้` when the request fails or `screen` is null;
- `อนุญาต` and `ปฏิเสธ` buttons, which send the `allow` and `deny` actions through the existing `useCommand`;
- a `เปิดแผงเต็ม` button, which sets `expanded` and shows the full command panel.

### Behaviour

- While a command is sending, both decision buttons are disabled.
- After a command succeeds the popover stays open. The feed moves the agent out of the waiting state within one poll (2 s), and the view then switches to the full command panel for that agent, so the owner sees what happened next.
- A command error shows the same error text the command panel shows.
- When `agent.terminal` is null the decision buttons are not rendered and the popover says `session นี้ไม่มี terminal ที่เขียนได้ ตอบจากที่นี่ไม่ได้`.
- Escape closes the popover and clears the selection, as it does for the command panel.
- The popover follows the character: its anchor is recomputed from the agent's position each frame the popover is open, using the same view maths as the hotspot popovers.

## Code layout

| File | Purpose |
|---|---|
| `web/src/notify/notify-logic.ts` | Pure functions: `newlyWaiting(previous, current)`, `alertText(agent)`, `tabTitle(count)`, `canAlert(enabled, permission, visibility)`. |
| `web/src/notify/notify-logic.test.ts` | Tests for the above. |
| `web/src/notify/use-waiting-alerts.ts` | Hook: keeps the previous snapshot, sets the title, fires notifications, handles the click. |
| `web/src/notify/use-alert-setting.ts` | Hook: the stored switch, the permission request, the "blocked by browser" state. |
| `web/src/panel/QuickReply.tsx` | The popover. Uses `HotspotPopover`, `useSession`, `useCommand`, `lastScreenLines`. |
| `web/src/hotspots/ThemeDock.tsx` | Gains the bell button. |
| `web/src/App.tsx` | Calls `useWaitingAlerts`; chooses `QuickReply` or `CommandPanel` for the selected agent. |
| `web/src/office/office-engine.ts` | Exposes the selected agent's room position so the popover can anchor to it. |

Repo rules apply: no comments, small functions, early returns, files under 300 lines.

## Testing

Unit tests (bun):

- `newlyWaiting`: working to waiting fires; waiting to waiting does not; a new agent that arrives already blocked fires; an agent that disappears does not; a null previous snapshot fires nothing.
- `alertText`: first line of the last message, truncation at 120 characters, both fallbacks.
- `tabTitle`: zero and non-zero counts.
- `canAlert`: every combination of switch, permission and visibility that should and should not fire.
- The choice between quick reply and command panel, as a pure function of agent state and `expanded`.

Browser check at `localhost:4300`:

- title count matches the reception counter's needs-you count;
- the bell asks for permission once, and the switch survives a reload;
- with the tab in the background, an agent that starts waiting produces one notification, and clicking it focuses the tab with that agent selected;
- quick reply opens on a waiting agent and shows the terminal lines; `เปิดแผงเต็ม` opens the full panel; a working agent opens the full panel directly.

The allow and deny buttons are verified against a session started for the test, never against one of the owner's live sessions.
