import { homedir } from 'node:os'
import { join } from 'node:path'

export function dataDir(): string {
  const configured = process.env.ISEKAI_DATA_DIR
  if (configured) {
    return configured
  }
  return join(homedir(), '.isekai-office')
}
