import { describe, expect, test } from 'bun:test'
import { labelPlacement } from './state-label'

describe('labelPlacement', () => {
  test('a waiting character shows one label under its bubble, hovered or not', () => {
    expect(labelPlacement('waiting', false)).toBe('under-bubble')
    expect(labelPlacement('waiting', true)).toBe('under-bubble')
  })

  test('hovering another state shows its label above the head', () => {
    expect(labelPlacement('working', true)).toBe('above-head')
    expect(labelPlacement('blocked', true)).toBe('above-head')
    expect(labelPlacement('done', true)).toBe('above-head')
  })

  test('a state that is not waiting and not hovered shows no label', () => {
    expect(labelPlacement('working', false)).toBeNull()
    expect(labelPlacement('blocked', false)).toBeNull()
    expect(labelPlacement('done', false)).toBeNull()
  })
})
