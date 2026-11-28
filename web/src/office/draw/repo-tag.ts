import { toScreenPoint, type ViewMetrics } from '../scene/view'
import { manaBarHeight, plateHeight } from './labels'
import type { ColorName } from './palette'

export const TAG_COLOURS = ['tag-0', 'tag-1', 'tag-2', 'tag-3', 'tag-4', 'tag-5', 'tag-6', 'tag-7'] as const satisfies readonly ColorName[]
export const NO_REPO_COLOUR: ColorName = 'tag-none'
export const NO_REPO_LABEL = 'ไม่ระบุ repo'

const FNV_OFFSET_BASIS = 0x811c9dc5
const FNV_PRIME = 0x01000193
const CHIP_RATIO = 0.8
const GAP_UNITS = 0.6

export type TagAnchor = { x: number; y: number; mana: number | null }

export type TagBox = { left: number; top: number; size: number }

function hashName(name: string): number {
  let hash = FNV_OFFSET_BASIS
  for (const character of name) {
    hash ^= character.codePointAt(0) ?? 0
    hash = Math.imul(hash, FNV_PRIME)
  }
  return hash >>> 0
}

export function repoTagColour(repo: string | null): ColorName {
  if (repo === null) {
    return NO_REPO_COLOUR
  }
  return TAG_COLOURS[hashName(repo) % TAG_COLOURS.length] ?? NO_REPO_COLOUR
}

export function repoTagLetter(repo: string | null): string {
  const first = repo === null ? undefined : Array.from(repo.trim())[0]
  return first === undefined ? '?' : first.toUpperCase()
}

export function repoTagGap(view: ViewMetrics): number {
  return Math.max(1, Math.round(view.scale * GAP_UNITS))
}

export function repoTagBox(view: ViewMetrics, anchor: TagAnchor): TagBox {
  const point = toScreenPoint(view, anchor.x, anchor.y + 2)
  const plate = plateHeight(view)
  const gap = repoTagGap(view)
  const manaBlock = anchor.mana === null ? 0 : manaBarHeight(view) + gap
  const size = Math.round(plate * CHIP_RATIO)
  return { left: Math.round(point.x - size / 2), top: Math.round(point.y + plate + gap + manaBlock), size }
}

export function repoTagHitBottom(view: ViewMetrics, anchor: TagAnchor): number {
  const box = repoTagBox(view, anchor)
  return (box.top + box.size - view.offsetY) / view.scale
}
