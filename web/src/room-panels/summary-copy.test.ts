import { describe, expect, test } from 'bun:test'
import { copyText } from './summary-copy'

describe('copyText', () => {
  test('rejects instead of throwing when the clipboard is missing', async () => {
    await expect(copyText('hello', undefined)).rejects.toThrow('clipboard_unavailable')
  })

  test('writes the text to the clipboard and resolves', async () => {
    const written: string[] = []
    await copyText('hello', { writeText: async (text) => void written.push(text) })
    expect(written).toEqual(['hello'])
  })

  test('rejects when the clipboard refuses', async () => {
    await expect(copyText('hello', { writeText: () => Promise.reject(new Error('denied')) })).rejects.toThrow('denied')
  })

  test('rejects when writeText throws before returning a promise', async () => {
    const clipboard = {
      writeText: (): Promise<void> => {
        throw new Error('blocked')
      }
    }
    await expect(copyText('hello', clipboard)).rejects.toThrow('blocked')
  })
})
