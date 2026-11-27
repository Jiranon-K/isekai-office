import type { PartyColour } from './party-logic'

export function Pennant({ colour }: { colour: PartyColour }): React.JSX.Element {
  return <span aria-hidden="true" className="inline-block h-4 w-3 shrink-0 rounded-xs border border-border" style={{ backgroundColor: `var(--office-${colour})` }} />
}
