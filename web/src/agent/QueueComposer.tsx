import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Failure } from './DecisionControls'
import { shouldSubmitOnKey } from './panel-logic'
import type { CommandStatus } from './use-command'

type QueueComposerProps = {
  disabled: boolean
  status: CommandStatus
  onPrompt(text: string): Promise<boolean>
  onEscape(): void
}

export function QueueComposer({ disabled, status, onPrompt, onEscape }: QueueComposerProps): React.JSX.Element {
  const [text, setText] = useState('')

  async function submit(): Promise<void> {
    const trimmed = text.trim()
    if (disabled || trimmed.length === 0) {
      return
    }
    if (await onPrompt(trimmed)) {
      setText('')
    }
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      onEscape()
      return
    }
    if (shouldSubmitOnKey(event.key, event.shiftKey, event.nativeEvent.isComposing)) {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={text}
        disabled={disabled}
        rows={1}
        className="min-h-9 resize-none"
        placeholder="พิมพ์ prompt แล้วกด Enter"
        aria-label="prompt ถึง session นี้"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <Failure status={status} />
    </div>
  )
}
