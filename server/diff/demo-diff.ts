import type { AgentDiff, ChangedFile } from '@shared/diff'

type DemoFixture = {
  branch: string | null
  files: ChangedFile[]
  error: string | null
}

const DEMO_FIXTURES: Record<string, DemoFixture> = {
  a1: {
    branch: 'feat/dark-mode',
    files: [
      { path: 'web/src/lib/theme.ts', status: 'modified', added: 22, removed: 8 },
      { path: 'web/src/components/ThemeToggle.tsx', status: 'added', added: 36, removed: 0 },
      { path: 'web/src/index.css', status: 'modified', added: 6, removed: 4 }
    ],
    error: null
  },
  a5: {
    branch: 'feat/onboarding',
    files: [
      { path: 'web/src/onboarding/Checklist.tsx', status: 'modified', added: 24, removed: 4 },
      { path: 'server/migrations/004_onboarding.sql', status: 'untracked', added: 14, removed: 0 }
    ],
    error: null
  },
  a7: {
    branch: 'feat/empty-states',
    files: [
      { path: 'web/src/components/EmptyState.tsx', status: 'added', added: 58, removed: 0 },
      { path: 'web/src/board/BoardView.tsx', status: 'modified', added: 32, removed: 11 },
      { path: 'web/src/room-panels/ArchivePanel.tsx', status: 'modified', added: 22, removed: 6 },
      { path: 'web/src/components/LegacyPlaceholder.tsx', status: 'deleted', added: 0, removed: 12 }
    ],
    error: null
  },
  a8: {
    branch: 'docs/changelog',
    files: [],
    error: null
  },
  a6: {
    branch: null,
    files: [],
    error: 'no_worktree'
  }
}

const FALLBACK_FIXTURE: DemoFixture = {
  branch: 'main',
  files: [{ path: 'src/index.ts', status: 'modified', added: 14, removed: 3 }],
  error: null
}

export function demoDiff(agentId: string): AgentDiff {
  const fixture = DEMO_FIXTURES[agentId] ?? FALLBACK_FIXTURE
  const totalAdded = fixture.files.reduce((sum, file) => sum + file.added, 0)
  const totalRemoved = fixture.files.reduce((sum, file) => sum + file.removed, 0)
  return {
    agentId,
    branch: fixture.branch,
    files: fixture.files.map((file) => ({ ...file })),
    totalAdded,
    totalRemoved,
    truncated: false,
    error: fixture.error
  }
}
