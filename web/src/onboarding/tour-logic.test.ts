import { describe, expect, test } from 'bun:test'
import type { AgentState, OfficeAgent } from '@shared/types'
import { readTourDone, TOUR_KEY, TOUR_STEP_COUNT, tourStep, writeTourDone, type TourStorage } from './tour-logic'

function agent(id: string, state: AgentState): OfficeAgent {
  return { id, title: id, repo: null, workspace: null, worktree: null, session: null, contextTokens: null, state, tool: null, lastMessage: null, updatedAt: 0, activeAt: 0, terminal: null }
}

function memoryStorage(entries: Record<string, string> = {}): TourStorage & { entries: Record<string, string> } {
  const store = { ...entries }
  return {
    entries: store,
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = value
    },
  }
}

const blockedStorage = (): TourStorage => {
  throw new Error('storage blocked')
}

describe('tour flag storage', () => {
  test('the tour is not done when nothing is stored', () => {
    expect(readTourDone(() => memoryStorage())).toBe(false)
  })

  test('the tour is done only when the stored value is 1', () => {
    expect(readTourDone(() => memoryStorage({ [TOUR_KEY]: '1' }))).toBe(true)
    expect(readTourDone(() => memoryStorage({ [TOUR_KEY]: '0' }))).toBe(false)
  })

  test('a blocked storage reads as not done', () => {
    expect(readTourDone(blockedStorage)).toBe(false)
  })

  test('finishing writes 1 under the tour key', () => {
    const storage = memoryStorage()
    expect(writeTourDone(() => storage)).toBe(true)
    expect(storage.entries[TOUR_KEY]).toBe('1')
  })

  test('a blocked storage fails the write without throwing', () => {
    expect(writeTourDone(blockedStorage)).toBe(false)
  })
})

describe('tour steps', () => {
  test('there are three steps', () => {
    expect(TOUR_STEP_COUNT).toBe(3)
  })

  test('step 1 points at the first character that needs an answer', () => {
    const agents = [agent('a', 'working'), agent('b', 'waiting'), agent('c', 'blocked')]
    expect(tourStep(0, { agents, readOnly: false })?.target).toEqual({ kind: 'agent', id: 'b' })
  })

  test('step 1 falls back to the reception desk when nobody needs an answer', () => {
    expect(tourStep(0, { agents: [agent('a', 'done')], readOnly: false })?.target).toEqual({ kind: 'hotspot', id: 'reception' })
  })

  test('step 1 text names the ! only when the target is a character that shows it', () => {
    const waiting = tourStep(0, { agents: [agent('a', 'waiting')], readOnly: false })
    const nobodyWaiting = tourStep(0, { agents: [agent('a', 'done')], readOnly: false })
    expect(waiting?.target.kind).toBe('agent')
    expect(waiting?.body).toBe('ตัวละครที่มีเครื่องหมาย ! คือเอเจนต์ที่รอคำตอบจากคุณ คลิกเพื่อตอบได้เลย')
    expect(nobodyWaiting?.target).toEqual({ kind: 'hotspot', id: 'reception' })
    expect(nobodyWaiting?.body).toBe('ตอนนี้ยังไม่มีเอเจนต์รอคำตอบ เมื่อมี ! ขึ้นมา คลิกได้จากห้องนี้')
  })

  test('step 1 text is the agent sentence when agents exist', () => {
    const step = tourStep(0, { agents: [agent('a', 'waiting')], readOnly: false })
    expect(step?.body).toBe('ตัวละครที่มีเครื่องหมาย ! คือเอเจนต์ที่รอคำตอบจากคุณ คลิกเพื่อตอบได้เลย')
    expect(step?.note).toBeNull()
  })

  test('an empty room changes the step 1 text and points at the reception desk', () => {
    const step = tourStep(0, { agents: [], readOnly: false })
    expect(step?.body).toBe('ยังไม่มีเอเจนต์ในห้อง เปิดเซสชัน Claude Code ในเทอร์มินัลเพื่อเริ่มงาน')
    expect(step?.target).toEqual({ kind: 'hotspot', id: 'reception' })
  })

  test('a read-only source adds the read-only note to step 1', () => {
    expect(tourStep(0, { agents: [agent('a', 'waiting')], readOnly: true })?.note).toBe('โหมดอ่านอย่างเดียว ตอบจากห้องไม่ได้')
  })

  test('step 2 points at the quest board and step 3 at the bookshelves', () => {
    const context = { agents: [], readOnly: false }
    expect(tourStep(1, context)).toEqual({ body: 'กระดานเควสรวมงานที่รอคุณไว้ที่เดียว', note: null, target: { kind: 'hotspot', id: 'questBoard' }, last: false })
    expect(tourStep(2, context)).toEqual({ body: 'ชั้นหนังสือเก็บประวัติเซสชันเก่า ค้นหาและอ่านย้อนหลังได้', note: null, target: { kind: 'hotspot', id: 'archive' }, last: true })
  })

  test('only the final step is marked last', () => {
    const context = { agents: [], readOnly: false }
    expect(tourStep(1, context)?.last).toBe(false)
    expect(tourStep(2, context)?.last).toBe(true)
  })

  test('no step exists past the end', () => {
    expect(tourStep(TOUR_STEP_COUNT, { agents: [], readOnly: false })).toBeNull()
  })
})
