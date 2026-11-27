import { addUsage, createUsageState, usageOf, type UsageState } from './usage'

const CHUNK_BYTES = 4 * 1024 * 1024
const NEWLINE = 10

type FileUsage = { offset: number; carry: Buffer; state: UsageState }

export type UsageReader = {
  read(path: string, size: number): Promise<UsageState>
  offsetOf(path: string): number | null
  keepOnly(paths: Set<string>): void
}

function freshFile(): FileUsage {
  return { offset: 0, carry: Buffer.alloc(0), state: createUsageState() }
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

export function createUsageReader(): UsageReader {
  const files = new Map<string, FileUsage>()

  async function read(path: string, size: number): Promise<UsageState> {
    const known = files.get(path)
    const file = known && size >= known.offset ? known : freshFile()
    files.set(path, file)
    await advance(file, path, size)
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
