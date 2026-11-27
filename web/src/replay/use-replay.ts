import type { OfficeAgent } from '@shared/types'
import { useCallback, useMemo, useRef, useState } from 'react'
import { parseReplay, type PanelId } from '@/lib/route'
import type { GroupId } from '@/office/scene/stations'
import { clampAt, snapsActors, type ReplaySpeed } from './playback-logic'
import { agentsAt, groupOfReplay, nextEventAt, previousEventAt, toOfficeAgent, type ReplayAgent, type ReplayDay } from './replay-logic'
import { useReplayDay } from './use-replay-day'
import { useReplayKeys } from './use-replay-keys'
import { useReplayPlayback } from './use-replay-playback'
import { useReplayUrl, writeReplayUrl } from './use-replay-url'

export type PanelBridge = { open: PanelId | null; close(): void; restore(id: PanelId): void }

export type ReplayStatus = 'loading' | 'error' | 'ready'

export type Replay = {
  active: boolean
  status: ReplayStatus
  date: string | null
  at: number
  day: ReplayDay | null
  playing: boolean
  speed: ReplaySpeed
  snap: boolean
  agents: OfficeAgent[]
  groupOf: (agent: OfficeAgent) => GroupId
  picked: ReplayAgent | null
  enter(date: string): void
  leave(): void
  togglePlay(): void
  setSpeed(speed: ReplaySpeed): void
  seek(at: number): void
  previous(): void
  next(): void
  pick(agentId: string | null): void
}

type Position = { at: number | null; seeking: boolean }

const DEFAULT_SPEED: ReplaySpeed = 30

export function useReplay(panel: PanelBridge): Replay {
  const [initial] = useState(() => parseReplay(location.search))
  const [date, setDate] = useState<string | null>(initial?.date ?? null)
  const [loadId, setLoadId] = useState(0)
  const [position, setPosition] = useState<Position>({ at: initial?.at ?? null, seeking: true })
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<ReplaySpeed>(DEFAULT_SPEED)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const previousPanel = useRef<PanelId | null>(null)
  const loaded = useReplayDay(date, loadId)
  const day = loaded.status === 'ready' ? loaded.day : null
  const events = loaded.status === 'ready' ? loaded.events : null
  const at = day ? clampAt(day, position.at ?? day.start) : 0

  const folded = useMemo(() => (events ? agentsAt(events, at) : []), [events, at])
  const agents = useMemo(() => folded.map(toOfficeAgent), [folded])
  const groupOf = useMemo(() => groupOfReplay(folded), [folded])
  const picked = folded.find((agent) => agent.agentId === pickedId) ?? null

  const seek = useCallback(
    (target: number) => setPosition({ at: day ? clampAt(day, target) : target, seeking: true }),
    [day]
  )
  const enter = useCallback(
    (nextDate: string) => {
      if (date === null) {
        previousPanel.current = panel.open
      }
      panel.close()
      setDate(nextDate)
      setLoadId((current) => current + 1)
      setPosition({ at: null, seeking: true })
      setPlaying(false)
      setPickedId(null)
    },
    [date, panel]
  )
  const leave = useCallback(() => {
    writeReplayUrl(null, null)
    setDate(null)
    setPlaying(false)
    setPickedId(null)
    if (previousPanel.current !== null) {
      panel.restore(previousPanel.current)
    }
    previousPanel.current = null
  }, [panel])
  const togglePlay = useCallback(() => {
    if (day === null) {
      return
    }
    if (!playing && at >= day.end) {
      seek(day.start)
    }
    setPlaying(!playing)
  }, [day, playing, at, seek])
  const previous = useCallback(() => {
    const target = events ? previousEventAt(events, at) : null
    if (target !== null) {
      seek(target)
    }
  }, [events, at, seek])
  const next = useCallback(() => {
    const target = events ? nextEventAt(events, at) : null
    if (target !== null) {
      seek(target)
    }
  }, [events, at, seek])

  useReplayPlayback({
    day,
    playing,
    speed,
    at,
    onAdvance: (advanced) => setPosition({ at: advanced, seeking: false }),
    onEnded: () => setPlaying(false)
  })
  useReplayUrl(date, at, day !== null, playing)
  useReplayKeys(date !== null, (action) => {
    const handlers = { toggle: togglePlay, previous, next, leave }
    handlers[action]()
  })

  return {
    active: date !== null,
    status: loaded.status,
    date,
    at,
    day,
    playing,
    speed,
    snap: snapsActors(speed, position.seeking),
    agents,
    groupOf,
    picked,
    enter,
    leave,
    togglePlay,
    setSpeed,
    seek,
    previous,
    next,
    pick: setPickedId
  }
}
