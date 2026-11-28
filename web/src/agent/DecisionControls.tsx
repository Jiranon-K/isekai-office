import type { Choice, SessionDetail } from '@shared/types'
import { AllowIcon, DenyIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Loadable } from '@/lib/api'
import { choiceExcerpt } from './choice-logic'
import { commandFailureText } from './command-error-logic'
import { lastScreenLines } from './panel-logic'
import type { CommandStatus } from './use-command'

const SCREEN_LINES = 6

export function ScreenLines({ session, choices }: { session: Loadable<SessionDetail>; choices: Choice[] }): React.JSX.Element {
  if (!session.data && session.loading) {
    return <Skeleton className="h-24 w-full" />
  }
  const screen = session.data?.screen
  if (!screen) {
    return <p className="rounded-md bg-muted p-2 text-small text-muted-foreground">อ่านหน้าจอ terminal ไม่ได้</p>
  }
  return (
    <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-caption whitespace-pre-wrap">
      {(choices.length > 0 && choiceExcerpt(screen)) || lastScreenLines(screen, SCREEN_LINES)}
    </pre>
  )
}

export function Failure({ status }: { status: CommandStatus }): React.JSX.Element | null {
  if (status.kind !== 'failed') {
    return null
  }
  return (
    <p role="alert" className="text-caption text-tint-red-fg">
      {commandFailureText(status.reason)}
    </p>
  )
}

export function ChoiceList({
  choices,
  status,
  disabled,
  onChoose,
  onDeny
}: {
  choices: Choice[]
  status: CommandStatus
  disabled: boolean
  onChoose(choice: number): void
  onDeny(): void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {choices.map((choice, index) => (
        <Button
          key={choice.number}
          variant={index === 0 ? 'default' : 'outline'}
          className="h-auto min-h-9 justify-start py-1.5 text-left whitespace-normal"
          disabled={disabled}
          onClick={() => onChoose(choice.number)}
        >
          {choice.number}. {choice.label}
        </Button>
      ))}
      <Button variant="outline" disabled={disabled} onClick={onDeny}>
        <DenyIcon />
        ปฏิเสธ
      </Button>
      <Failure status={status} />
    </div>
  )
}

export function Decision({
  status,
  disabled,
  onAllow,
  onDeny
}: {
  status: CommandStatus
  disabled: boolean
  onAllow(): void
  onDeny(): void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button className="flex-1" disabled={disabled} onClick={onAllow}>
          <AllowIcon />
          อนุญาต
        </Button>
        <Button variant="outline" className="flex-1" disabled={disabled} onClick={onDeny}>
          <DenyIcon />
          ปฏิเสธ
        </Button>
      </div>
      <Failure status={status} />
    </div>
  )
}
