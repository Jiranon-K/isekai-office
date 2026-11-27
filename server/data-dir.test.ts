import { afterEach, describe, expect, test } from 'bun:test'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { dataDir } from './data-dir'

const original = process.env.ISEKAI_DATA_DIR

afterEach(() => {
  if (original === undefined) {
    delete process.env.ISEKAI_DATA_DIR
    return
  }
  process.env.ISEKAI_DATA_DIR = original
})

describe('dataDir', () => {
  test('uses ISEKAI_DATA_DIR when it is set, read at call time', () => {
    process.env.ISEKAI_DATA_DIR = 'first'
    expect(dataDir()).toBe('first')
    process.env.ISEKAI_DATA_DIR = 'second'
    expect(dataDir()).toBe('second')
  })

  test('falls back to a folder in the home directory when unset or empty', () => {
    delete process.env.ISEKAI_DATA_DIR
    expect(dataDir()).toBe(join(homedir(), '.isekai-office'))
    process.env.ISEKAI_DATA_DIR = ''
    expect(dataDir()).toBe(join(homedir(), '.isekai-office'))
  })
})
