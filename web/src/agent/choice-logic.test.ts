import { describe, expect, test } from 'bun:test'
import { choiceExcerpt, choiceForKey, parseChoices } from './choice-logic'

const PERMISSION = [
  '⏺ Bash(bun run db:migrate)',
  '',
  ' Do you want to proceed?',
  ' ❯ 1. Yes',
  '   2. Yes, and do not ask again for bun run commands',
  '   3. No, and tell Claude what to do differently (esc)'
].join('\n')

const QUESTION = [
  'Which database should the checklist use?',
  '',
  '❯ 1. Postgres',
  '     The existing primary database',
  '  2. SQLite',
  '     Fast for local runs',
  '  3. Redis',
  '     Good for counters',
  '  4. Other',
  '     Something else'
].join('\n')

const PROSE = ['Here are the steps:', '1. Read the spec', '2. Write the migration', '3. Run the tests'].join('\n')

describe('parseChoices', () => {
  test('a permission prompt with three options gives three choices and marks the cursor', () => {
    expect(parseChoices(PERMISSION)).toEqual([
      { number: 1, label: 'Yes', selected: true },
      { number: 2, label: 'Yes, and do not ask again for bun run commands', selected: false },
      { number: 3, label: 'No, and tell Claude what to do differently (esc)', selected: false }
    ])
  })

  test('a question with four options and descriptions gives four labelled choices', () => {
    expect(parseChoices(QUESTION).map((choice) => choice.label)).toEqual(['Postgres', 'SQLite', 'Redis', 'Other'])
  })

  test('numbered prose without a cursor marker gives no choices', () => {
    expect(parseChoices(PROSE)).toEqual([])
  })

  test('a run that starts at 2 gives no choices', () => {
    expect(parseChoices(' ❯ 2. Yes\n   3. No')).toEqual([])
  })

  test('a run with a gap gives no choices', () => {
    expect(parseChoices(' ❯ 1. Yes\n   3. No')).toEqual([])
  })

  test('a single option gives no choices', () => {
    expect(parseChoices(' ❯ 1. Yes')).toEqual([])
  })

  test('two cursor markers give no choices', () => {
    expect(parseChoices(' ❯ 1. Yes\n > 2. No')).toEqual([])
  })

  test('an empty screen gives no choices', () => {
    expect(parseChoices('')).toEqual([])
  })

  test('only the last run counts', () => {
    const screen = [PROSE, '', 'Pick one', '> 1. A', '  2. B'].join('\n')
    expect(parseChoices(screen).map((choice) => choice.label)).toEqual(['A', 'B'])
  })

  test('a prose list after a live prompt hides the prompt', () => {
    expect(parseChoices([PERMISSION, '', PROSE].join('\n'))).toEqual([])
  })

  test('a label is cut to 60 characters', () => {
    const long = 'x'.repeat(80)
    const choices = parseChoices(` ❯ 1. ${long}\n   2. No`)
    expect(choices[0]?.label).toBe('x'.repeat(60))
  })
})

describe('choiceExcerpt', () => {
  test('starts at the question and ends at the last choice', () => {
    expect(choiceExcerpt(PERMISSION)).toBe(PERMISSION.split('\n').slice(2).join('\n'))
  })

  test('includes the description lines under the last choice', () => {
    expect(choiceExcerpt(QUESTION)).toBe(QUESTION)
  })

  test('is empty when there are no choices', () => {
    expect(choiceExcerpt(PROSE)).toBe('')
  })
})

describe('choiceForKey', () => {
  const choices = parseChoices(PERMISSION)

  test('a digit with a matching choice picks it', () => {
    expect(choiceForKey('2', choices)).toBe(2)
  })

  test('a digit with no matching choice does nothing', () => {
    expect(choiceForKey('7', choices)).toBeNull()
    expect(choiceForKey('0', choices)).toBeNull()
  })

  test('other keys do nothing', () => {
    expect(choiceForKey('a', choices)).toBeNull()
    expect(choiceForKey('12', choices)).toBeNull()
  })
})
