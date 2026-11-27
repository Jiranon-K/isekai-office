import { isWatched, nextWatchedAt, type ReplayDay } from './replay-logic'

export const REPLAY_SPEEDS = [1, 30, 120] as const

export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number]

export type PlaybackStep = { at: number; ended: boolean }

export function stepPlayback(day: ReplayDay, at: number, elapsedMs: number, speed: ReplaySpeed): PlaybackStep {
  const target = at + elapsedMs * speed
  if (target >= day.end) {
    return { at: day.end, ended: true }
  }
  if (isWatched(day.watched, target)) {
    return { at: target, ended: false }
  }
  const resume = nextWatchedAt(day.watched, target)
  return resume === null ? { at: day.end, ended: true } : { at: resume, ended: false }
}

export function snapsActors(speed: ReplaySpeed, seeking: boolean): boolean {
  return seeking || speed === 120
}

export function clampAt(day: ReplayDay, at: number): number {
  return Math.min(day.end, Math.max(day.start, at))
}
