import type { OfficeAgent } from '@shared/types'
import type { QuestTemplate } from '@shared/templates'
import { PROMPT_MAX } from '@shared/spawn'
import { useRef, useState } from 'react'
import { SendIcon, StopIcon2 } from '@/components/icons'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { CommandStatus } from './use-command'
import { commandFailureText } from './command-error-logic'
import { shouldSubmitOnKey } from './panel-logic'
import { TemplateMenu } from './TemplateMenu'
import { agentTemplateValues, insertTemplate } from './template-insert-logic'

type CommandComposerProps = {
  agent: Pick<OfficeAgent, 'repo' | 'worktree'>
  disabled: boolean
  status: CommandStatus
  onPrompt(text: string): Promise<boolean>
  onEscape(): void
}

function StatusLine({ status }: { status: CommandStatus }): React.JSX.Element | null {
  if (status.kind === 'sending') {
    return (
      <p role="status" className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <Spinner className="size-3" />
        กำลังส่ง
      </p>
    )
  }
  if (status.kind === 'sent') {
    return <p role="status" className="text-caption text-tint-green-fg">ส่งคำสั่งแล้ว</p>
  }
  if (status.kind === 'failed') {
    return <p role="alert" className="text-caption text-tint-red-fg">{commandFailureText(status.reason)}</p>
  }
  return null
}

export function CommandComposer({ agent, disabled, status, onPrompt, onEscape }: CommandComposerProps): React.JSX.Element {
  const [text, setText] = useState('')
  const [refused, setRefused] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const sending = status.kind === 'sending'
  const canSend = !disabled && !sending && text.trim().length > 0

  async function submit(): Promise<void> {
    if (!canSend) {
      return
    }
    const sent = await onPrompt(text.trim())
    if (sent) {
      setText('')
    }
  }

  function insert(template: QuestTemplate): void {
    const start = box.current?.selectionStart ?? text.length
    const end = box.current?.selectionEnd ?? text.length
    const inserted = insertTemplate(text, start, end, template, agentTemplateValues(agent))
    setRefused(inserted === null)
    if (inserted === null) {
      return
    }
    setText(inserted.text)
    requestAnimationFrame(() => {
      box.current?.focus()
      box.current?.setSelectionRange(inserted.cursor, inserted.cursor)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        ref={box}
        value={text}
        disabled={disabled}
        onChange={(event) => {
          setText(event.target.value)
          setRefused(false)
        }}
        onKeyDown={(event) => {
          if (!shouldSubmitOnKey(event.key, event.shiftKey, event.nativeEvent.isComposing)) {
            return
          }
          event.preventDefault()
          void submit()
        }}
        placeholder="พิมพ์ prompt หรือ slash command…"
        aria-label="prompt ถึง session นี้"
        className="min-h-16"
        rows={2}
      />
      <div className="flex items-center gap-2">
        <StatusLine status={status} />
        {refused ? <p role="alert" className="text-caption text-tint-red-fg">แม่แบบยาวเกิน {PROMPT_MAX} ตัวอักษร ไม่ได้แทรก</p> : null}
        <TemplateMenu disabled={disabled || sending} onPick={insert} />
        <Button variant="outline" size="sm" className="ml-auto" disabled={disabled || sending} onClick={onEscape}>
          <StopIcon2 />
          หยุด (Esc)
        </Button>
        <Button size="sm" disabled={!canSend} onClick={() => void submit()}>
          {sending ? <Spinner /> : <SendIcon />}
          ส่ง
        </Button>
      </div>
    </div>
  )
}
