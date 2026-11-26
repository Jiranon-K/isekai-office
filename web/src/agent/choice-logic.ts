import type { Choice } from '@shared/types'

const CHOICE_LINE = /^\s*(❯|>)?\s*(\d)\.\s+(.+)$/
const INDENTED_TEXT = /^\s+\S/
const LABEL_LIMIT = 60

type Run = { start: number; end: number; choices: Choice[] }

function toChoice(line: string): Choice | null {
  const match = CHOICE_LINE.exec(line)
  if (!match) {
    return null
  }
  return { number: Number(match[2]), label: (match[3] ?? '').trim().slice(0, LABEL_LIMIT), selected: match[1] !== undefined }
}

function lastRun(lines: string[]): Run | null {
  let run: Run | null = null
  let open = false
  lines.forEach((line, index) => {
    const choice = toChoice(line)
    if (choice) {
      run = open && run ? { ...run, end: index, choices: [...run.choices, choice] } : { start: index, end: index, choices: [choice] }
      open = true
      return
    }
    open = open && INDENTED_TEXT.test(line)
    if (open && run) {
      run = { ...run, end: index }
    }
  })
  return run
}

function isLiveRun(choices: Choice[]): boolean {
  if (choices.length < 2) {
    return false
  }
  if (!choices.every((choice, index) => choice.number === index + 1)) {
    return false
  }
  return choices.filter((choice) => choice.selected).length === 1
}

function liveRun(screen: string): { lines: string[]; run: Run } | null {
  const lines = screen.split('\n')
  const run = lastRun(lines)
  return run && isLiveRun(run.choices) ? { lines, run } : null
}

export function parseChoices(screen: string): Choice[] {
  return liveRun(screen)?.run.choices ?? []
}

export function choiceExcerpt(screen: string): string {
  const live = liveRun(screen)
  if (!live) {
    return ''
  }
  let start = live.run.start
  while (start > 0 && (live.lines[start - 1] ?? '').trim() === '') {
    start -= 1
  }
  while (start > 0 && (live.lines[start - 1] ?? '').trim() !== '') {
    start -= 1
  }
  return live.lines.slice(start, live.run.end + 1).join('\n')
}

export function choiceForKey(key: string, choices: Choice[]): number | null {
  if (!/^[1-9]$/.test(key)) {
    return null
  }
  const number = Number(key)
  return choices.some((choice) => choice.number === number) ? number : null
}
