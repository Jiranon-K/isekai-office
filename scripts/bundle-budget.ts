import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

export const JAVASCRIPT_BUDGET_BYTES = 145_000

export type BundleSize = { firstPaint: number; all: number }

export function firstPaintScripts(html: string): string[] {
  const links = html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)
  return [...new Set([...links].map((match) => match[1] ?? ''))]
}

function gzippedBytes(dist: string, files: string[]): number {
  return files.reduce((total, file) => total + gzipSync(readFileSync(join(dist, file))).length, 0)
}

export function measureBundle(dist: string): BundleSize {
  const entry = firstPaintScripts(readFileSync(join(dist, 'index.html'), 'utf8'))
  if (entry.length === 0) {
    throw new Error(`no script found in ${join(dist, 'index.html')}`)
  }
  const all = readdirSync(join(dist, 'assets')).filter((file) => file.endsWith('.js'))
  return { firstPaint: gzippedBytes(dist, entry), all: gzippedBytes(dist, all.map((file) => `assets/${file}`)) }
}

export function isOverBudget(size: BundleSize): boolean {
  return size.firstPaint > JAVASCRIPT_BUDGET_BYTES
}

export function describeBundle(size: BundleSize): string {
  const verdict = isOverBudget(size) ? 'OVER BUDGET' : 'ok'
  return [
    `JavaScript on first paint: ${size.firstPaint} bytes gzipped, allowed ${JAVASCRIPT_BUDGET_BYTES} (${verdict})`,
    `All JavaScript: ${size.all} bytes gzipped (reported, not enforced)`
  ].join('\n')
}

if (import.meta.main) {
  const size = measureBundle(join(import.meta.dir, '..', 'dist'))
  console.log(describeBundle(size))
  process.exit(isOverBudget(size) ? 1 : 0)
}
