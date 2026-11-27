import type { OfficeAgent } from '@shared/types'
import { useEffect, useRef, useState } from 'react'
import { describeResult } from '@/agent/panel-logic'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { sendCommand } from '@/lib/api'
import { claimSubmit, releaseSubmit, runBroadcast } from './broadcast-logic'
import { canReceive, type BroadcastRow, type Party } from './party-logic'
import { PartyMemberRow } from './PartyMemberRow'

type PartyComposerProps = { party: Party; agents: OfficeAgent[] }

async function sendPrompt(agentId: string, text: string): Promise<string | null> {
  return describeResult(await sendCommand({ agentId, action: 'prompt', text }))
}

function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set)
  if (!next.delete(id)) {
    next.add(id)
  }
  return next
}

export function PartyComposer({ party, agents }: PartyComposerProps): React.JSX.Element {
  const [text, setText] = useState('')
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set())
  const [rows, setRows] = useState<BroadcastRow[]>([])
  const [running, setRunning] = useState(false)
  const latest = useRef(agents)
  latest.current = agents
  const cancelled = useRef(false)
  const submitting = useRef(false)
  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
    }
  }, [])
  const chosen = party.members.filter((member) => canReceive(member) && !unticked.has(member.id))
  const canSend = !running && chosen.length > 0 && text.trim().length > 0

  async function submit(): Promise<void> {
    if (!claimSubmit(submitting)) {
      return
    }
    setRunning(true)
    await runBroadcast(
      chosen.map((member) => member.id),
      text.trim(),
      {
        latest: (id) => latest.current.find((agent) => agent.id === id) ?? null,
        send: sendPrompt,
        report: setRows,
        isCancelled: () => cancelled.current
      }
    )
    releaseSubmit(submitting)
    if (!cancelled.current) {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="พิมพ์ prompt ที่จะส่งให้ทั้งปาร์ตี้…"
        aria-label={`prompt ถึงปาร์ตี้ ${party.name}`}
        className="min-h-16"
        rows={2}
      />
      <ul className="flex flex-col">
        {party.members.map((member) => (
          <PartyMemberRow
            key={member.id}
            agent={member}
            ticked={canReceive(member) && !unticked.has(member.id)}
            locked={running}
            row={rows.find((row) => row.agentId === member.id && row.status !== 'idle') ?? null}
            onToggle={() => setUnticked((current) => toggled(current, member.id))}
          />
        ))}
      </ul>
      <Button size="sm" disabled={!canSend} onClick={() => void submit()}>
        {`ส่งให้ ${chosen.length} คน`}
      </Button>
    </div>
  )
}
