import { AlertIcon, RefreshIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { classifyBoardError } from './board-logic'

const KEYCHAIN_COMMAND = 'security add-generic-password -U -s isekai-office-workspace -a me -w'

type BoardErrorProps = { error: string; onRetry(): void }

function ErrorBody({ error }: { error: string }): React.JSX.Element {
  const kind = classifyBoardError(error)
  if (kind === 'missing_token') {
    return (
      <>
        <p className="text-body">Keychain item isekai-office-workspace ยังว่างอยู่ จึงดึง card จาก Workspace ไม่ได้ ใส่ token แล้วกดลองใหม่</p>
        <code className="block overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-caption whitespace-nowrap">{KEYCHAIN_COMMAND}</code>
      </>
    )
  }
  if (kind === 'unauthorized') {
    return <p className="text-body">token ของ Workspace หมดอายุหรือไม่ถูกต้อง ออก token ใหม่แล้วเก็บลง Keychain item isekai-office-workspace อีกครั้ง จากนั้นกดลองใหม่</p>
  }
  if (kind === 'unreachable') {
    return <p className="text-body">ติดต่อ server ไม่ได้ เช็กว่า server ยังรันอยู่ แล้วกดลองใหม่</p>
  }
  return <p className="text-body">โหลด Quest Board ไม่สำเร็จ ({error}) กดลองใหม่อีกครั้ง</p>
}

export function BoardError({ error, onRetry }: BoardErrorProps): React.JSX.Element {
  return (
    <div role="alert" className="flex max-w-2xl flex-col items-start gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-center gap-2 text-body-strong">
        <AlertIcon className="text-destructive" />
        โหลด Quest Board ไม่ได้
      </div>
      <ErrorBody error={error} />
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshIcon />
        ลองใหม่
      </Button>
    </div>
  )
}
