import { useEffect, useRef } from 'react'
import { Kbd } from '@/components/kbd'
import { isTyping } from '@/lib/keyboard'

type BoardSearchProps = { value: string; onChange(value: string): void }

export function BoardSearch({ value, onChange }: BoardSearchProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function focusOnSlash(event: KeyboardEvent): void {
      if (event.key !== '/' || isTyping(event.target)) {
        return
      }
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', focusOnSlash)
    return () => window.removeEventListener('keydown', focusOnSlash)
  }, [])

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== 'Escape') {
      return
    }
    event.preventDefault()
    if (value) {
      onChange('')
      return
    }
    event.currentTarget.blur()
  }

  return (
    <label className="focus-ring-within flex h-8 min-w-48 flex-1 items-center gap-2 rounded-md border border-border bg-popover px-2 text-small sm:max-w-80">
      <span className="sr-only">ค้นหาการ์ดด้วย key หรือชื่อ</span>
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={value}
        placeholder="ค้นหา key หรือชื่อการ์ด"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
      />
      <Kbd>/</Kbd>
    </label>
  )
}
