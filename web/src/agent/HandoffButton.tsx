import { useEffect, useRef, useState } from 'react'
import type { HandoffDraft } from '@shared/handoff'
import type { OfficeAgent } from '@shared/types'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { fetchSession } from '@/lib/api'
import { useSourceCaps } from '@/lib/source-caps'
import { COPIED_RESET_MS, executeHandoff, handoffLabel, type HandoffStatus } from './handoff-logic'

type HandoffButtonProps = {
  agent: OfficeAgent
  onHandoff(draft: HandoffDraft): void
  onManualCopy?(prompt: string): void
}

type HandoffCopyFallbackProps = {
  prompt: string
  onClose(): void
}

function clipboardWriter(): ((value: string) => Promise<void>) | null {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return null
  }
  return (value) => navigator.clipboard.writeText(value)
}

export function HandoffCopyFallback({ prompt, onClose }: HandoffCopyFallbackProps): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const node = textareaRef.current
    if (!node) {
      return
    }
    node.focus()
    node.select()
  }, [prompt])

  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-md border bg-muted/60 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-muted-foreground">คัดลอกอัตโนมัติไม่ได้ กด Ctrl+C เพื่อคัดลอก</span>
        <Button type="button" variant="ghost" size="xs" onClick={onClose}>
          ปิด
        </Button>
      </div>
      <Textarea
        ref={textareaRef}
        readOnly
        aria-label="ข้อความส่งไม้ต่อ"
        value={prompt}
        className="min-h-24 font-mono text-caption"
        onFocus={(event) => event.currentTarget.select()}
      />
    </div>
  )
}

export function HandoffButton({ agent, onHandoff, onManualCopy }: HandoffButtonProps): React.JSX.Element {
  const caps = useSourceCaps()
  const [status, setStatus] = useState<HandoffStatus>('idle')
  const [inlinePrompt, setInlinePrompt] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const activeAgentIdRef = useRef(agent.id)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    activeAgentIdRef.current = agent.id
    setStatus('idle')
    setInlinePrompt(null)
  }, [agent.id])

  async function handleClick(): Promise<void> {
    if (status === 'loading') {
      return
    }
    const targetId = agent.id
    setStatus('loading')
    const outcome = await executeHandoff(agent, caps.spawn, fetchSession, clipboardWriter())
    if (!mountedRef.current || activeAgentIdRef.current !== targetId) {
      return
    }
    if (outcome.kind === 'spawn') {
      setStatus('idle')
      onHandoff(outcome.draft)
      return
    }
    if (outcome.kind === 'copied') {
      setInlinePrompt(null)
      setStatus('copied')
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setStatus('idle')
        }
      }, COPIED_RESET_MS)
      return
    }
    setStatus('idle')
    if (onManualCopy) {
      onManualCopy(outcome.draft.prompt)
      return
    }
    setInlinePrompt(outcome.draft.prompt)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={status === 'loading'}
        onClick={() => void handleClick()}
      >
        {status === 'loading' ? <Spinner className="size-3" /> : handoffLabel(caps.spawn, status)}
      </Button>
      {inlinePrompt !== null ? (
        <div className="basis-full">
          <HandoffCopyFallback prompt={inlinePrompt} onClose={() => setInlinePrompt(null)} />
        </div>
      ) : null}
    </>
  )
}
