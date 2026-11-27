import { ReplayBar } from './ReplayBar'
import { ReplayBanner, ReplayCard } from './ReplayBanner'
import type { Replay } from './use-replay'

export function ReplayOverlay({ replay }: { replay: Replay }): React.JSX.Element | null {
  if (!replay.active) {
    return null
  }
  return (
    <>
      <ReplayBanner replay={replay} />
      <ReplayCard replay={replay} />
      {replay.day ? <ReplayBar replay={replay} day={replay.day} /> : null}
    </>
  )
}
