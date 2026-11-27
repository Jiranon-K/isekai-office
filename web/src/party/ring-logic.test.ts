import { describe, expect, test } from 'bun:test'
import { ringedPartyKey } from './ring-logic'

const members = [
  { id: 'a', partyKey: 'epic:Checkout' },
  { id: 'b', partyKey: 'epic:Checkout' },
  { id: 'c', partyKey: 'repo:api' },
  { id: 'd', partyKey: null }
]

describe('ringedPartyKey', () => {
  test('selecting one member rings the party of that member', () => {
    expect(ringedPartyKey(members, null, 'a')).toBe('epic:Checkout')
  })

  test('hovering a member rings its party even when another agent is selected', () => {
    expect(ringedPartyKey(members, 'c', 'a')).toBe('repo:api')
  })

  test('hovering an agent in no party falls back to the selected party', () => {
    expect(ringedPartyKey(members, 'd', 'a')).toBe('epic:Checkout')
  })

  test('an agent in no party rings nothing', () => {
    expect(ringedPartyKey(members, null, 'd')).toBeNull()
  })

  test('nothing hovered or selected rings nothing', () => {
    expect(ringedPartyKey(members, null, null)).toBeNull()
  })

  test('an unknown id rings nothing', () => {
    expect(ringedPartyKey(members, 'zzz', 'yyy')).toBeNull()
  })

  test('nothing hovered or selected does not read the members at all', () => {
    const unreadable: Iterable<{ id: string; partyKey: string | null }> = {
      [Symbol.iterator]() {
        throw new Error('members were read')
      }
    }
    expect(ringedPartyKey(unreadable, null, null)).toBeNull()
  })

  test('stops reading once both party keys are found', () => {
    let read = 0
    function* counted(): Generator<{ id: string; partyKey: string | null }> {
      for (const member of members) {
        read += 1
        yield member
      }
    }
    expect(ringedPartyKey(counted(), 'a', 'b')).toBe('epic:Checkout')
    expect(read).toBe(1)
  })
})
