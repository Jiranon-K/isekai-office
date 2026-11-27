import { addUsage, createUsageState, usageOf, type UsageState } from './usage'

const CHUNK_BYTES = 1024 * 1024
const NEWLINE = 10
const HEAD_BYTES = 64

type FileUsage = { offset: number; size: number; modifiedAt: number | null; head: Buffer; carry: Buffer; state: UsageState }

export type UsageReader = {
  read(path: string, size: number, modifiedAt?: number): Promise<UsageState>
  offsetOf(path: string): number | null
  keepOnly(paths: Set<string>): void
}

function freshFile(): FileUsage {
  return { offset: 0, size: 0, modifiedAt: null, head: Buffer.alloc(0), carry: Buffer.alloc(0), state: createUsageState() }
}

function consumeLines(file: FileUsage, bytes: Buffer): void {
  const joined = Buffer.concat([file.carry, bytes])
  const lastBreak = joined.lastIndexOf(NEWLINE)
  file.carry = Buffer.from(joined.subarray(lastBreak + 1))
  if (lastBreak === -1) {
    return
  }
  for (const line of joined.subarray(0, lastBreak).toString('utf8').split('\n')) {
    const usage = usageOf(line)
    if (usage) {
      addUsage(file.state, usage)
    }
  }
}

async function readSlice(path: string, from: number, to: number): Promise<Buffer> {
  return Buffer.from(await Bun.file(path).slice(from, to).arrayBuffer())
}

async function advance(file: FileUsage, path: string, size: number): Promise<void> {
  while (file.offset < size) {
    const end = Math.min(file.offset + CHUNK_BYTES, size)
    consumeLines(file, await readSlice(path, file.offset, end))
    file.offset = end
  }
}

function sameStart(first: Buffer, second: Buffer): boolean {
  const length = Math.min(first.length, second.length)
  return first.subarray(0, length).equals(second.subarray(0, length))
}

function isContinuation(file: FileUsage, size: number, modifiedAt: number | undefined, head: Buffer): boolean {
  if (size < file.offset || !sameStart(file.head, head)) {
    return false
  }
  const touched = modifiedAt !== undefined && file.modifiedAt !== null && modifiedAt !== file.modifiedAt
  return !touched || size > file.size
}

export function createUsageReader(): UsageReader {
  const files = new Map<string, FileUsage>()

  async function read(path: string, size: number, modifiedAt?: number): Promise<UsageState> {
    const known = files.get(path)
    const head = await readSlice(path, 0, Math.min(HEAD_BYTES, size))
    const file = known && isContinuation(known, size, modifiedAt, head) ? known : freshFile()
    files.set(path, file)
    await advance(file, path, size)
    file.size = size
    file.modifiedAt = modifiedAt ?? null
    file.head = head
    return file.state
  }

  function keepOnly(paths: Set<string>): void {
    for (const path of files.keys()) {
      if (!paths.has(path)) {
        files.delete(path)
      }
    }
  }

  return { read, offsetOf: (path) => files.get(path)?.offset ?? null, keepOnly }
}
