import { isValidBaseBranch, PROMPT_MAX } from './spawn'
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

const HANDOFF_PREFIX = 'handoff-'
const MAX_NAME_LENGTH = 48
const TITLE_MAX = 200
const USER_GOAL_MAX = 600
const SUMMARY_MAX = 1500
const CONTINUATION_LINE = 'Continue or review this work from the current branch state. Verify before editing.'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function clipText(value: string, limit: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= limit) {
    return trimmed
  }
  return `${trimmed.slice(0, limit - 1).trimEnd()}…`
}

function firstUserGoal(entries: readonly SessionEntry[]): string | null {
  const entry = entries.find((item) => item.role === 'user' && item.text.trim() !== '')
  return entry ? clipText(entry.text, USER_GOAL_MAX) : null
}

function latestAssistantSummary(agent: OfficeAgent, entries: readonly SessionEntry[]): string | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]
    if (entry && entry.role === 'assistant' && entry.text.trim() !== '') {
      return clipText(entry.text, SUMMARY_MAX)
    }
  }
  if (agent.lastMessage && agent.lastMessage.trim() !== '') {
    return clipText(agent.lastMessage, SUMMARY_MAX)
  }
  return null
}

function clampPrompt(body: string, footer: string): string {
  const combined = `${body}\n\n${footer}`
  if (combined.length <= PROMPT_MAX) {
    return combined
  }
  const budget = PROMPT_MAX - footer.length - 3
  if (budget <= 0) {
    return footer.slice(0, PROMPT_MAX)
  }
  return `${body.slice(0, budget).trimEnd()}…\n\n${footer}`
}

export function suggestHandoffName(title: string, agentId: string): string {
  const titleSlug = slugify(title)
  const fallbackSlug = slugify(agentId) || 'session'
  const rawSuffix = titleSlug || fallbackSlug
  const maxSuffix = MAX_NAME_LENGTH - HANDOFF_PREFIX.length
  const suffix = rawSuffix.slice(0, maxSuffix).replace(/-+$/g, '')
  return `${HANDOFF_PREFIX}${suffix || 'session'}`
}

export function buildHandoffPrompt(agent: OfficeAgent, entries: readonly SessionEntry[]): string {
  const headerLines = [`Handoff from: ${clipText(agent.title, TITLE_MAX)}`]
  if (agent.repo && agent.repo.trim() !== '') {
    headerLines.push(`Repo: ${agent.repo.trim()}`)
  }
  if (agent.workspace && agent.workspace.trim() !== '') {
    headerLines.push(`Branch: ${agent.workspace.trim()}`)
  }
  headerLines.push(`State: ${agent.state}`)
  const sections = [headerLines.join('\n')]
  const goal = firstUserGoal(entries)
  if (goal) {
    sections.push(`Goal:\n${goal}`)
  }
  const summary = latestAssistantSummary(agent, entries)
  if (summary) {
    sections.push(`Latest summary:\n${summary}`)
  }
  return clampPrompt(sections.join('\n\n'), CONTINUATION_LINE)
}

export function matchRepoId(repos: readonly OrcaRepo[], repoName: string | null): string {
  const target = repoName?.trim().toLowerCase()
  if (target) {
    const matched = repos.find((repo) => repo.name.trim().toLowerCase() === target)
    if (matched) {
      return matched.id
    }
  }
  return repos[0]?.id ?? ''
}

export function createHandoffDraft(agent: OfficeAgent, entries: readonly SessionEntry[] | null): HandoffDraft {
  const branch = agent.workspace?.trim() ?? ''
  return {
    sourceAgentId: agent.id,
    sourceTitle: agent.title,
    repoName: agent.repo,
    name: suggestHandoffName(agent.title, agent.id),
    baseBranch: branch !== '' && isValidBaseBranch(branch) ? branch : '',
    prompt: buildHandoffPrompt(agent, entries ?? []),
    fallbackUsed: entries === null
  }
}
