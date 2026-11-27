import { describe, expect, test } from 'bun:test'
import { currentSourceCaps, publishSourceCaps } from './source-caps'

describe('source caps', () => {
  test('everything is allowed until a snapshot says otherwise', () => {
    expect(currentSourceCaps()).toEqual({ command: true, spawn: true, screen: true })
  })

  test('a published read only source switches every cap off and a missing value switches them back on', () => {
    publishSourceCaps({ command: false, spawn: false, screen: false })
    expect(currentSourceCaps()).toEqual({ command: false, spawn: false, screen: false })
    publishSourceCaps(undefined)
    expect(currentSourceCaps().command).toBe(true)
  })

  test('the same caps keep the same object so readers do not rerender', () => {
    publishSourceCaps({ command: false, spawn: true, screen: true })
    const first = currentSourceCaps()
    publishSourceCaps({ command: false, spawn: true, screen: true })
    expect(currentSourceCaps()).toBe(first)
    publishSourceCaps(undefined)
  })
})
