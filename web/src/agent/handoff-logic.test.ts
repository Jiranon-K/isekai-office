import { describe, expect, test } from 'bun:test'
import type { OfficeAgent, SessionDetail } from '@shared/types'
import { copyHandoffPrompt, executeHandoff, handoffLabel, loadHandoffDraft } from './handoff-logic'

function makeAgent(overrides: Partial<OfficeAgent> = {}): OfficeAgent {
  return {
    id: 'a6',
    title: 'OPS-9 rotate signing keys',
    repo: 'infra',
    workspace: 'main',
    worktree: null,
    session: null,
    contextTokens: 705_000,
    state: 'blocked',
    tool: null,
    lastMessage: 'I need the staging vault path before I can continue.',
    updatedAt: 1000,
    activeAt: 1000,
    stateSince: 0,
    terminal: 'demo-a6',
    ...overrides
  }
}

const SESSION: SessionDetail = {
  id: 'a6',
  screen: null,
  entries: [
    { role: 'user', text: 'Rotate staging signing keys safely.', tools: [], at: 1 },
    { role: 'assistant', text: 'Prepared key rotation script and verified staging config.', tools: [], at: 2 }
  ]
}

describe('handoffLabel', () => {
  test('uses spawn label when writable and copy label when read-only', () => {
    expect(handoffLabel(true, 'idle')).toBe('ส่งไม้ต่อ')
    expect(handoffLabel(false, 'idle')).toBe('คัดลอกส่งไม้ต่อ')
    expect(handoffLabel(false, 'copied')).toBe('คัดลอกแล้ว')
  })
})

describe('loadHandoffDraft', () => {
  test('builds draft from transcript entries when session fetch succeeds', async () => {
    const draft = await loadHandoffDraft(makeAgent(), async () => SESSION)
    expect(draft.fallbackUsed).toBe(false)
    expect(draft.name).toBe('handoff-ops-9-rotate-signing-keys')
    expect(draft.baseBranch).toBe('main')
    expect(draft.prompt).toContain('Rotate staging signing keys safely.')
    expect(draft.prompt).toContain('Prepared key rotation script and verified staging config.')
  })

  test('falls back to agent.lastMessage when session fetch fails', async () => {
    const draft = await loadHandoffDraft(makeAgent(), async () => {
      throw new Error('session_unavailable')
    })
    expect(draft.fallbackUsed).toBe(true)
    expect(draft.prompt).toContain('I need the staging vault path before I can continue.')
  })
})

describe('copyHandoffPrompt', () => {
  test('returns copied when clipboard write succeeds', async () => {
    let written = ''
    const result = await copyHandoffPrompt('handoff body', async (value) => {
      written = value
    })
    expect(result).toBe('copied')
    expect(written).toBe('handoff body')
  })

  test('returns fallback when clipboard is unavailable or rejects', async () => {
    expect(await copyHandoffPrompt('handoff body', null)).toBe('fallback')
    expect(
      await copyHandoffPrompt('handoff body', async () => {
        throw new Error('permission_denied')
      })
    ).toBe('fallback')
  })
})

describe('executeHandoff', () => {
  test('returns spawn outcome in writable mode without calling clipboard', async () => {
    let clipboardCalled = false
    const outcome = await executeHandoff(
      makeAgent(),
      true,
      async () => SESSION,
      async () => {
        clipboardCalled = true
      }
    )
    expect(outcome.kind).toBe('spawn')
    expect(outcome.draft.sourceAgentId).toBe('a6')
    expect(clipboardCalled).toBe(false)
  })

  test('copies prompt in read-only mode when clipboard succeeds', async () => {
    let copied = ''
    const outcome = await executeHandoff(
      makeAgent(),
      false,
      async () => SESSION,
      async (value) => {
        copied = value
      }
    )
    expect(outcome.kind).toBe('copied')
    expect(copied).toBe(outcome.draft.prompt)
  })

  test('returns manual copy fallback in read-only mode when clipboard write fails', async () => {
    const outcome = await executeHandoff(
      makeAgent(),
      false,
      async () => {
        throw new Error('network_error')
      },
      async () => {
        throw new Error('denied')
      }
    )
    expect(outcome.kind).toBe('fallback')
    expect(outcome.draft.fallbackUsed).toBe(true)
    expect(outcome.draft.prompt).toContain('I need the staging vault path before I can continue.')
  })
})
