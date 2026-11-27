export type ClipboardWriter = { writeText(text: string): Promise<void> }

export async function copyText(text: string, clipboard: ClipboardWriter | undefined = globalThis.navigator?.clipboard): Promise<void> {
  if (!clipboard) {
    throw new Error('clipboard_unavailable')
  }
  await clipboard.writeText(text)
}
