import type { OfficeAgent } from '@shared/types'
import { needsDecision } from '@/agent/panel-logic'
import type { HotspotId } from '@/office/scene/hotspots'

export const TOUR_KEY = 'isekai-office.tour.done'
const DONE_VALUE = '1'
const RECEPTION: HotspotId = 'reception'

const AGENT_BODY = 'ตัวละครที่มีเครื่องหมาย ! คือเอเจนต์ที่รอคำตอบจากคุณ คลิกเพื่อตอบได้เลย'
const EMPTY_BODY = 'ยังไม่มีเอเจนต์ในห้อง เปิดเซสชัน Claude Code ในเทอร์มินัลเพื่อเริ่มงาน'
const READ_ONLY_NOTE = 'โหมดอ่านอย่างเดียว ตอบจากห้องไม่ได้'
const QUEST_BODY = 'กระดานเควสรวมงานที่รอคุณไว้ที่เดียว'
const ARCHIVE_BODY = 'ชั้นหนังสือเก็บประวัติเซสชันเก่า ค้นหาและอ่านย้อนหลังได้'

export type TourTarget = { kind: 'agent'; id: string } | { kind: 'hotspot'; id: HotspotId }

export type TourContext = { agents: readonly OfficeAgent[]; readOnly: boolean }

export type TourStep = { body: string; note: string | null; target: TourTarget; last: boolean }

export type TourStorage = Pick<Storage, 'getItem' | 'setItem'>

type StepDefinition = {
  body(context: TourContext): string
  note(context: TourContext): string | null
  target(context: TourContext): TourTarget
}

function firstNeedsYou(agents: readonly OfficeAgent[]): TourTarget {
  const agent = agents.find((candidate) => needsDecision(candidate.state))
  return agent ? { kind: 'agent', id: agent.id } : { kind: 'hotspot', id: RECEPTION }
}

const STEPS: readonly StepDefinition[] = [
  {
    body: ({ agents }) => (agents.length === 0 ? EMPTY_BODY : AGENT_BODY),
    note: ({ readOnly }) => (readOnly ? READ_ONLY_NOTE : null),
    target: ({ agents }) => firstNeedsYou(agents),
  },
  {
    body: () => QUEST_BODY,
    note: () => null,
    target: () => ({ kind: 'hotspot', id: 'questBoard' }),
  },
  {
    body: () => ARCHIVE_BODY,
    note: () => null,
    target: () => ({ kind: 'hotspot', id: 'archive' }),
  },
]

export const TOUR_STEP_COUNT = STEPS.length

export function tourStep(index: number, context: TourContext): TourStep | null {
  const definition = STEPS[index]
  if (!definition) {
    return null
  }
  return {
    body: definition.body(context),
    note: definition.note(context),
    target: definition.target(context),
    last: index === STEPS.length - 1,
  }
}

export function readTourDone(openStorage: () => TourStorage): boolean {
  try {
    return openStorage().getItem(TOUR_KEY) === DONE_VALUE
  } catch {
    return false
  }
}

export function writeTourDone(openStorage: () => TourStorage): boolean {
  try {
    openStorage().setItem(TOUR_KEY, DONE_VALUE)
    return true
  } catch {
    return false
  }
}
