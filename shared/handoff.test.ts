import { describe, expect, test } from 'bun:test'
import { isValidName, PROMPT_MAX } from './spawn'
import type { OfficeAgent, OrcaRepo, SessionEntry } from './types'
import { buildHandoffPrompt, createHandoffDraft, matchRepoId, suggestHandoffName } from './handoff'

function makeAgent(overrides: Partial<OfficeAgent> = {}): OfficeAgent {
  return {
    id: 'a7',
    title: 'APP-9 empty states',
    repo: 'web-app',
    workspace: 'main',
    worktree: null,
    session: null,
    contextTokens: 452_000,
    state: 'done',
    tool: null,
    lastMessage: 'Opened the merge request and all checks pass.',
    updatedAt: 1000,
    activeAt: 1000,
    stateSince: 0,
    terminal: 'demo-a7',
    ...overrides
  }
}

describe('suggestHandoffName', () => {
  test('prefixes ASCII titles with handoff- and normalizes punctuation', () => {
    expect(suggestHandoffName('APP-12 dark mode toggle', 'a1')).toBe('handoff-app-12-dark-mode-toggle')
    expect(suggestHandoffName('APP-9 empty states', 'a7')).toBe('handoff-app-9-empty-states')
  })

  test('falls back to sanitized agentId for Thai-only titles', () => {
    const name = suggestHandoffName('ปรับหน้าจอห้องกิลด์', 'agent_42')
    expect(name).toBe('handoff-agent-42')
    expect(isValidName(name)).toBe(true)
  })

  test('falls back to handoff-session when both title and id have no ASCII characters', () => {
    const name = suggestHandoffName('ภาษาไทยล้วน', '!!!')
    expect(name).toBe('handoff-session')
    expect(isValidName(name)).toBe(true)
  })

  test('caps length at 48 characters and always satisfies NAME_PATTERN', () => {
    const longTitle = 'APP-999 implement very long feature name that exceeds forty eight characters easily'
    const name = suggestHandoffName(longTitle, 'a1')
    expect(name.length).toBeLessThanOrEqual(48)
    expect(name.endsWith('-')).toBe(false)
    expect(isValidName(name)).toBe(true)
  })
})

describe('buildHandoffPrompt', () => {
  test('includes metadata, earliest user goal, latest non-empty assistant summary, and continuation line', () => {
    const entries: SessionEntry[] = [
      { role: 'user', text: 'First goal from user.', tools: [], at: 1 },
      { role: 'assistant', text: 'Early note.', tools: [], at: 2 },
      { role: 'user', text: 'Second follow-up.', tools: [], at: 3 },
      { role: 'assistant', text: 'Final summary of changes.', tools: [], at: 4 },
      { role: 'assistant', text: '', tools: ['Bash'], at: 5 }
    ]
    const prompt = buildHandoffPrompt(makeAgent(), entries)
    expect(prompt).toContain('Handoff from: APP-9 empty states')
    expect(prompt).toContain('Repo: web-app')
    expect(prompt).toContain('Branch: main')
    expect(prompt).toContain('State: done')
    expect(prompt).toContain('First goal from user.')
    expect(prompt).not.toContain('Second follow-up.')
    expect(prompt).toContain('Final summary of changes.')
    expect(prompt).not.toContain('Early note.')
    expect(prompt).toEndWith('Continue or review this work from the current branch state. Verify before editing.')
  })

  test('falls back to agent.lastMessage when transcript has no assistant text', () => {
    const prompt = buildHandoffPrompt(makeAgent(), [{ role: 'assistant', text: '', tools: ['Read'], at: 1 }])
    expect(prompt).toContain('Opened the merge request and all checks pass.')
  })

  test('produces a valid prompt when transcript and lastMessage are both empty', () => {
    const prompt = buildHandoffPrompt(makeAgent({ lastMessage: null }), [])
    expect(prompt).toContain('Handoff from: APP-9 empty states')
    expect(prompt).toContain('Repo: web-app')
    expect(prompt).toContain('Branch: main')
    expect(prompt).toEndWith('Continue or review this work from the current branch state. Verify before editing.')
  })

  test('trims long user goal, assistant summary, and enforces PROMPT_MAX', () => {
    const entries: SessionEntry[] = [
      { role: 'user', text: 'u'.repeat(1200), tools: [], at: 1 },
      { role: 'assistant', text: 'a'.repeat(3000), tools: [], at: 2 }
    ]
    const prompt = buildHandoffPrompt(makeAgent({ repo: 'r'.repeat(2500), workspace: 'b'.repeat(2500) }), entries)
    expect(prompt.length).toBeLessThanOrEqual(PROMPT_MAX)
    expect(prompt).toEndWith('Continue or review this work from the current branch state. Verify before editing.')
  })
})

describe('matchRepoId', () => {
  const repos: OrcaRepo[] = [
    { id: 'r1', name: 'tavern-api' },
    { id: 'r2', name: 'Web-App' }
  ]

  test('matches repo name case-insensitively', () => {
    expect(matchRepoId(repos, 'web-app')).toBe('r2')
    expect(matchRepoId(repos, 'TAVERN-API')).toBe('r1')
  })

  test('falls back to first repo or empty string when unmatched', () => {
    expect(matchRepoId(repos, 'unknown')).toBe('r1')
    expect(matchRepoId(repos, null)).toBe('r1')
    expect(matchRepoId([], 'web-app')).toBe('')
  })
})

describe('createHandoffDraft', () => {
  test('marks fallbackUsed when entries are null and validates baseBranch', () => {
    const draft = createHandoffDraft(makeAgent({ workspace: 'feat/empty-states' }), null)
    expect(draft.sourceAgentId).toBe('a7')
    expect(draft.sourceTitle).toBe('APP-9 empty states')
    expect(draft.repoName).toBe('web-app')
    expect(draft.name).toBe('handoff-app-9-empty-states')
    expect(draft.baseBranch).toBe('feat/empty-states')
    expect(draft.fallbackUsed).toBe(true)
    expect(draft.prompt).toContain('Opened the merge request and all checks pass.')
  })

  test('clears invalid baseBranch values', () => {
    expect(createHandoffDraft(makeAgent({ workspace: '-bad-branch' }), []).baseBranch).toBe('')
    expect(createHandoffDraft(makeAgent({ workspace: 'branch with spaces' }), []).baseBranch).toBe('')
    expect(createHandoffDraft(makeAgent({ workspace: null }), []).baseBranch).toBe('')
  })
})
