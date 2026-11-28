import { describe, expect, test } from 'bun:test'
import type { AgentState } from '@shared/types'
import { hearthTone, WAIT_ALERT_MS, type HearthSubject } from './hearth-alert'

const NOW = 10_000_000

function agent(state: AgentState, waitedMs: number): HearthSubject {
  return { kind: 'agent', state, stateSince: NOW - waitedMs }
}

describe('hearthTone', () => {
  test('the threshold is two minutes', () => {
    expect(WAIT_ALERT_MS).toBe(120_000)
  })

  test('exactly two minutes of waiting is not yet red', () => {
    expect(hearthTone([agent('waiting', WAIT_ALERT_MS)], NOW, true)).toBe('amber')
  })

  test('longer than two minutes of waiting turns red', () => {
    expect(hearthTone([agent('waiting', WAIT_ALERT_MS + 1)], NOW, true)).toBe('red')
  })

  test('a blocked agent that waits counts the same as a waiting one', () => {
    expect(hearthTone([agent('blocked', WAIT_ALERT_MS + 1)], NOW, true)).toBe('red')
  })

  test('working and done agents never turn it red, however long they have been in that state', () => {
    expect(hearthTone([agent('working', WAIT_ALERT_MS * 5), agent('done', WAIT_ALERT_MS * 5)], NOW, true)).toBe('amber')
  })

  test('one long waiter among short ones is enough', () => {
    expect(hearthTone([agent('waiting', 5_000), agent('waiting', WAIT_ALERT_MS + 1)], NOW, true)).toBe('red')
  })

  test('no waiting agent keeps the amber glow', () => {
    expect(hearthTone([agent('working', 1_000)], NOW, true)).toBe('amber')
  })

  test('without a usable start time a waiting agent never turns it red', () => {
    expect(hearthTone([{ kind: 'agent', state: 'waiting', stateSince: null }], NOW, true)).toBe('amber')
    expect(hearthTone([{ kind: 'agent', state: 'waiting', stateSince: Number.NaN }], NOW, true)).toBe('amber')
  })

  test('no data from the server is dim, never red', () => {
    expect(hearthTone([agent('waiting', WAIT_ALERT_MS * 3)], NOW, false)).toBe('dim')
  })

  test('an empty room is dim', () => {
    expect(hearthTone([], NOW, true)).toBe('dim')
  })

  test('characters that are not agents do not count', () => {
    expect(hearthTone([{ kind: 'npc', state: 'waiting', stateSince: NOW - WAIT_ALERT_MS * 3 }], NOW, true)).toBe('dim')
  })
})
