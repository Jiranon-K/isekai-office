import { describe, expect, test } from 'bun:test'
import { chooseSourceId } from './select'

describe('source choice', () => {
  test('orca and local are taken as written whatever is installed', () => {
    expect(chooseSourceId('orca', false)).toBe('orca')
    expect(chooseSourceId('local', true)).toBe('local')
  })

  test('auto and anything else pick orca when its binary exists and local when it does not', () => {
    for (const setting of ['auto', undefined, '', 'bogus']) {
      expect(chooseSourceId(setting, true)).toBe('orca')
      expect(chooseSourceId(setting, false)).toBe('local')
    }
  })
})
