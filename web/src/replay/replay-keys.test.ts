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

  test('leaves space to a focused button so a click is not toggled twice', () => {
    expect(replayKeyAction(press(' '), false, { onButton: true, panelOpen: false })).toBeNull()
    expect(replayKeyAction(press('ArrowRight'), false, { onButton: true, panelOpen: false })).toBe('next')
    expect(replayKeyAction(press('Escape'), false, { onButton: true, panelOpen: false })).toBe('leave')
  })

  test('lets escape close an open panel before it leaves replay', () => {
    expect(replayKeyAction(press('Escape'), false, { onButton: false, panelOpen: true })).toBeNull()
    expect(replayKeyAction(press(' '), false, { onButton: false, panelOpen: true })).toBe('toggle')
    expect(replayKeyAction(press('Escape'), false, { onButton: false, panelOpen: false })).toBe('leave')
  })

  test('does not toggle again while space is held but keeps stepping on held arrows', () => {
    expect(replayKeyAction(press(' ', { repeat: true }), false)).toBeNull()
    expect(replayKeyAction(press('ArrowRight', { repeat: true }), false)).toBe('next')
  })
})
