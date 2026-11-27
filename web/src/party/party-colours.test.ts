import { describe, expect, test } from 'bun:test'
import { COLOR_NAMES } from '@/office/draw/palette'
import { PARTY_COLOURS } from './party-logic'

async function blockOf(selector: string): Promise<string> {
  const css = await Bun.file(new URL('../office/tokens.css', import.meta.url)).text()
  const start = css.indexOf(`${selector} {`)
  return css.slice(start, css.indexOf('}', start))
}

describe('party colours', () => {
  test('the canvas palette reads every party colour', () => {
    expect(PARTY_COLOURS.filter((name) => !COLOR_NAMES.includes(name))).toEqual([])
  })

  test('the day tokens declare every party colour', async () => {
    const day = await blockOf(':root')
    expect(PARTY_COLOURS.filter((name) => !day.includes(`--office-${name}:`))).toEqual([])
  })

  test('the night tokens declare every party colour', async () => {
    const night = await blockOf(':root.dark')
    expect(PARTY_COLOURS.filter((name) => !night.includes(`--office-${name}:`))).toEqual([])
  })

  test('day and night give each party colour a different value', async () => {
    const day = await blockOf(':root')
    const night = await blockOf(':root.dark')
    const valueOf = (block: string, name: string): string | undefined => block.match(new RegExp(`--office-${name}: ([^;]+);`))?.[1]
    expect(PARTY_COLOURS.filter((name) => valueOf(day, name) === valueOf(night, name))).toEqual([])
  })
})
