import { createHandoffDraft, type HandoffDraft } from '@shared/handoff'
import type { OfficeAgent, SessionDetail } from '@shared/types'

export type HandoffStatus = 'idle' | 'loading' | 'copied'

export type HandoffOutcome =
  | { kind: 'spawn'; draft: HandoffDraft }
  | { kind: 'copied'; draft: HandoffDraft }
  | { kind: 'fallback'; draft: HandoffDraft }

export const COPIED_RESET_MS = 2_000

export function handoffLabel(canSpawn: boolean, status: HandoffStatus): string {
  if (status === 'copied') {
    return 'คัดลอกแล้ว'
  }
  return canSpawn ? 'ส่งไม้ต่อ' : 'คัดลอกส่งไม้ต่อ'
}

export async function loadHandoffDraft(
  agent: OfficeAgent,
  loadSession: (agentId: string) => Promise<SessionDetail>
): Promise<HandoffDraft> {
  try {
    const detail = await loadSession(agent.id)
    return createHandoffDraft(agent, detail.entries)
  } catch {
    return createHandoffDraft(agent, null)
  }
}

export async function copyHandoffPrompt(
  prompt: string,
  writeText: ((value: string) => Promise<void>) | null
): Promise<'copied' | 'fallback'> {
  if (!writeText) {
    return 'fallback'
  }
  try {
    await writeText(prompt)
    return 'copied'
  } catch {
    return 'fallback'
  }
}

export async function executeHandoff(
  agent: OfficeAgent,
  canSpawn: boolean,
  loadSession: (agentId: string) => Promise<SessionDetail>,
  writeText: ((value: string) => Promise<void>) | null
): Promise<HandoffOutcome> {
  const draft = await loadHandoffDraft(agent, loadSession)
  if (canSpawn) {
    return { kind: 'spawn', draft }
  }
  const copied = await copyHandoffPrompt(draft.prompt, writeText)
  return { kind: copied, draft }
}
