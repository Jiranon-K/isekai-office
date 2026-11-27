import { describe, expect, test } from 'bun:test'
import { replayKeyAction } from './replay-keys'

function press(key: string, extra: Partial<Parameters<typeof replayKeyAction>[0]> = {}): Parameters<typeof replayKeyAction>[0] {
  return { key, ctrlKey: false, metaKey: false, altKey: false, repeat: false, ...extra }
}

describe('replayKeyAction', () => {
  test('maps space, the two arrows and escape', () => {
    expect(replayKeyAction(press(' '), false)).toBe('toggle')
    expect(replayKeyAction(press('ArrowLeft'), false)).toBe('previous')
    expect(replayKeyAction(press('ArrowRight'), false)).toBe('next')
    expect(replayKeyAction(press('Escape'), false)).toBe('leave')
  })

  test('is ignored while typing', () => {
    expect(replayKeyAction(press(' '), true)).toBeNull()
    expect(replayKeyAction(press('ArrowLeft'), true)).toBeNull()
    expect(replayKeyAction(press('Escape'), true)).toBeNull()
  })

  test('ignores other keys and modified keys', () => {
    expect(replayKeyAction(press('a'), false)).toBeNull()
    expect(replayKeyAction(press('ArrowRight', { ctrlKey: true }), false)).toBeNull()
    expect(replayKeyAction(press('ArrowRight', { metaKey: true }), false)).toBeNull()
  })

  test('does not toggle again while space is held but keeps stepping on held arrows', () => {
    expect(replayKeyAction(press(' ', { repeat: true }), false)).toBeNull()
    expect(replayKeyAction(press('ArrowRight', { repeat: true }), false)).toBe('next')
  })
})
