import type { ConflictSnapshot } from '@shared/conflicts'

const MINUTE = 60_000

export function demoConflicts(now = Date.now()): ConflictSnapshot {
  return {
    conflicts: [
      { repo: 'web-app', path: 'src/checkout/cart.ts', agentIds: ['a1', 'a2'], updatedAt: now - MINUTE },
      { repo: 'web-app', path: 'src/checkout/summary.tsx', agentIds: ['a1', 'a5'], updatedAt: now - 2 * MINUTE }
    ],
    at: now
  }
}
