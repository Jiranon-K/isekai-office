import { afterAll, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describeBundle, isOverBudget, JAVASCRIPT_BUDGET_BYTES, measureBundle } from './bundle-budget'

const created: string[] = []

afterAll(() => created.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

function build(html: string, assets: Record<string, string>): string {
  const dist = mkdtempSync(join(tmpdir(), 'bundle-budget-'))
  created.push(dist)
  mkdirSync(join(dist, 'assets'))
  writeFileSync(join(dist, 'index.html'), html)
  Object.entries(assets).forEach(([name, content]) => writeFileSync(join(dist, 'assets', name), content))
  return dist
}

const ENTRY = '<script type="module" src="/assets/index.js"></script>'
const PRELOAD = '<link rel="modulepreload" href="/assets/shared.js">'

test('first paint counts the entry and preloaded chunks but not lazy ones', () => {
  const assets = { 'index.js': 'a'.repeat(100), 'shared.js': 'b'.repeat(100), 'lazy.js': 'c'.repeat(100) }
  const entryOnly = measureBundle(build(ENTRY, assets))
  const withPreload = measureBundle(build(ENTRY + PRELOAD, assets))
  expect(withPreload.firstPaint).toBeGreaterThan(entryOnly.firstPaint)
  expect(withPreload.all).toBeGreaterThan(withPreload.firstPaint)
})

test('a bundle over the budget fails and shows actual against allowed', () => {
  const size = { firstPaint: JAVASCRIPT_BUDGET_BYTES + 1, all: JAVASCRIPT_BUDGET_BYTES + 1 }
  expect(isOverBudget(size)).toBe(true)
  expect(describeBundle(size)).toContain(`${JAVASCRIPT_BUDGET_BYTES + 1} bytes gzipped, allowed ${JAVASCRIPT_BUDGET_BYTES} (OVER BUDGET)`)
})

test('a bundle at the budget passes', () => {
  expect(isOverBudget({ firstPaint: JAVASCRIPT_BUDGET_BYTES, all: 999_999 })).toBe(false)
})

test('a build without an entry script is an error, not a pass', () => {
  expect(() => measureBundle(build('<html></html>', {}))).toThrow('no script found')
})
