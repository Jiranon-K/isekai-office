import { describe, expect, test } from 'bun:test'
import { toScreenPoint, type ViewMetrics } from '../scene/view'
import { plateHeight } from './labels'
import { NO_REPO_COLOUR, NO_REPO_LABEL, TAG_COLOURS, namedRepo, repoTagBox, repoTagColour, repoTagHitBottom, repoTagLetter } from './repo-tag'

const VIEW: ViewMetrics = { width: 640, height: 384, dpr: 1, scale: 2, offsetX: 0, offsetY: 0 }
const REPO_NAMES = ['isekai-office', 'orca', 'project-w', 'docs', 'billing-api', 'mobile', 'infra', 'dotfiles', 'web-kit']

describe('repo tag colour', () => {
  test('the same repo name always gives the same colour', () => {
    for (const name of REPO_NAMES) {
      expect(repoTagColour(name)).toBe(repoTagColour(name))
    }
  })

  test('every colour is one of the eight tag colours', () => {
    for (const name of REPO_NAMES) {
      expect(TAG_COLOURS.some((colour) => colour === repoTagColour(name))).toBe(true)
    }
  })

  test('different repo names do not all share one colour', () => {
    expect(new Set(REPO_NAMES.map(repoTagColour)).size).toBeGreaterThan(2)
  })

  test('a character with no repo gets the gray colour', () => {
    expect(repoTagColour(null)).toBe(NO_REPO_COLOUR)
  })
})

describe('repo tag letter', () => {
  test('the letter is the first character of the repo name, upper-cased', () => {
    expect(repoTagLetter('isekai-office')).toBe('I')
    expect(repoTagLetter('  ops')).toBe('O')
  })

  test('no repo or an empty name shows a question mark', () => {
    expect(repoTagLetter(null)).toBe('?')
    expect(repoTagLetter('   ')).toBe('?')
  })

  test('the no-repo label is the Thai tooltip text', () => {
    expect(NO_REPO_LABEL).toBe('ไม่ระบุ repo')
  })
})

describe('repo tag position', () => {
  test('the tag sits below the name plate', () => {
    const box = repoTagBox(VIEW, { x: 100, y: 100, mana: null })
    const plateTop = toScreenPoint(VIEW, 100, 102).y
    expect(box.top).toBeGreaterThanOrEqual(plateTop + plateHeight(VIEW))
    expect(box.size).toBeGreaterThan(0)
  })

  test('the tag moves down when the mana bar takes the space under the name', () => {
    const withoutMana = repoTagBox(VIEW, { x: 100, y: 100, mana: null })
    const withMana = repoTagBox(VIEW, { x: 100, y: 100, mana: 0.5 })
    expect(withMana.top).toBeGreaterThan(withoutMana.top)
  })

  test('the hit area reaches down to the bottom of the tag', () => {
    const anchor = { x: 100, y: 100, mana: null }
    const box = repoTagBox(VIEW, anchor)
    expect(repoTagHitBottom(VIEW, anchor)).toBe((box.top + box.size) / VIEW.scale)
  })
})

describe('blank repo names', () => {
  test('a name that is only whitespace counts as no repo: gray colour and a question mark', () => {
    expect(repoTagColour('   ')).toBe(NO_REPO_COLOUR)
    expect(repoTagColour('\t \n')).toBe(NO_REPO_COLOUR)
    expect(repoTagLetter('   ')).toBe('?')
    expect(namedRepo('  \t ')).toBeNull()
  })

  test('surrounding spaces do not change the colour or the letter of a repo', () => {
    expect(repoTagColour('  web-app ')).toBe(repoTagColour('web-app'))
    expect(repoTagLetter('  web-app ')).toBe('W')
    expect(namedRepo('  web-app ')).toBe('web-app')
  })
})
