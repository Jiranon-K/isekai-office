import type { DayEvent } from '@shared/day-log'
import type { LogEvent, OfficeAgent, OfficeSnapshot } from '@shared/types'
import { diffEvents } from '../feeds/log'
import { dayMaxBytes } from './config'
import { localDate, NO_STATIONS, stateEvents, stationEvents, watchEvent, type StationMemory } from './events'
import { appendDayEvents, dayFileBytes, pruneDays, readRecentStates } from './store'

const RING_LIMIT = 100

let memory: StationMemory = NO_STATIONS
let memoryDate = ''
let queue: Promise<void> = Promise.resolve()
let prunedOn = ''

function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch((error: unknown) => {
    console.error('day log:', error)
  })
  return queue
}

async function pruneOnNewDate(at: number): Promise<void> {
  const date = localDate(at)
  if (date === prunedOn) {
    return
  }
  try {
    await pruneDays(at)
    prunedOn = date
  } catch (error) {
    console.error('day log prune:', error)
  }
}

async function write(at: number, states: DayEvent[], stations: DayEvent[]): Promise<void> {
  await pruneOnNewDate(at)
  const date = localDate(at)
  const roomLeft = stations.length === 0 || (await dayFileBytes(date)) <= dayMaxBytes()
  await appendDayEvents(date, roomLeft ? [...states, ...stations] : states)
}

export function recordWatch(on: boolean, at = Date.now()): Promise<void> {
  return enqueue(async () => {
    if (on) {
      memory = NO_STATIONS
    }
    await pruneOnNewDate(at)
    await appendDayEvents(localDate(at), [watchEvent(at, on)])
  })
}

export function recordTick(previousAgents: OfficeAgent[] | null, snapshot: OfficeSnapshot): Promise<void> {
  if (!snapshot.sourceReady || snapshot.error) {
    return Promise.resolve()
  }
  const changes = previousAgents === null ? [] : diffEvents(previousAgents, snapshot.agents, snapshot.at)
  const states = stateEvents(changes, previousAgents ?? [], snapshot.agents)
  return enqueue(async () => {
    const date = localDate(snapshot.at)
    if (date !== memoryDate) {
      memory = NO_STATIONS
      memoryDate = date
    }
    const stations = stationEvents(memory, snapshot.agents, snapshot.at)
    if (states.length > 0 || stations.events.length > 0) {
      await write(snapshot.at, states, stations.events)
    }
    memory = stations.memory
  })
}

export async function restoreRing(at = Date.now()): Promise<LogEvent[]> {
  try {
    await pruneOnNewDate(at)
  } catch (error) {
    console.error('day log prune:', error)
  }
  try {
    return await readRecentStates(localDate(at), RING_LIMIT)
  } catch (error) {
    console.error('day log restore:', error)
    return []
  }
}

export function resetRecorder(): void {
  memory = NO_STATIONS
  memoryDate = ''
  prunedOn = ''
}
