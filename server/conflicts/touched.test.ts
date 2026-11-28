import { describe, expect, test } from 'bun:test'
import { extractTouchedPaths, normalizeTouchedPath } from './touched'

function toolLine(name: string, input: Record<string, unknown>, type = 'assistant'): string {
  return JSON.stringify({
    type,
    message: {
      content: [{ type: 'tool_use', name, input }]
    }
  })
}

describe('normalizeTouchedPath', () => {
  test('normalizes Windows backslashes and strips worktree prefix case-insensitively', () => {
    expect(normalizeTouchedPath('D:\\Repo\\Web-App\\src\\checkout\\cart.ts', 'd:/repo/web-app')).toBe('src/checkout/cart.ts')
    expect(normalizeTouchedPath('/Users/dev/app/src/index.ts', '/Users/dev/app/')).toBe('src/index.ts')
    expect(normalizeTouchedPath('./src//nested\\file.ts', null)).toBe('src/nested/file.ts')
  })

  test('does not strip sibling directories sharing a name prefix', () => {
    expect(normalizeTouchedPath('/repo/app-other/src/a.ts', '/repo/app')).toBe('/repo/app-other/src/a.ts')
  })
})

describe('extractTouchedPaths', () => {
  test('extracts paths from write tools and ignores read tools, user rows, and broken JSON', () => {
    const lines = [
      'not valid json',
      toolLine('Read', { file_path: '/repo/src/ignored.ts' }),
      toolLine('Bash', { command: 'bun test' }),
      toolLine('Edit', { file_path: '/repo/src/a.ts' }, 'user'),
      toolLine('Edit', { file_path: '/repo/src/a.ts' }),
      toolLine('Write', { path: '/repo/src/b.ts' }),
      toolLine('MultiEdit', { file_path: '/repo/src/c.ts' }),
      toolLine('NotebookEdit', { notebook_path: '/repo/notebooks/eval.ipynb' })
    ]
    expect(extractTouchedPaths(lines, '/repo')).toEqual([
      'src/a.ts',
      'src/b.ts',
      'src/c.ts',
      'notebooks/eval.ipynb'
    ])
  })

  test('deduplicates repeated touches and caps at latest 50 unique paths', () => {
    const lines = [
      toolLine('Edit', { file_path: 'D:\\work\\src\\early.ts' }),
      ...Array.from({ length: 55 }, (_, index) => toolLine('Write', { file_path: `D:\\work\\src\\file-${index}.ts` })),
      toolLine('Edit', { file_path: 'D:\\work\\src\\early.ts' })
    ]
    const paths = extractTouchedPaths(lines, 'D:\\work')
    expect(paths).toHaveLength(50)
    expect(paths[0]).toBe('src/file-6.ts')
    expect(paths.at(-1)).toBe('src/early.ts')
  })
})
