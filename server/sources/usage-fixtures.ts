export type FixtureUsage = {
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
}

export function assistantLine(id: string, timestamp: string, usage: FixtureUsage, model = 'claude-sonnet-x'): string {
  return JSON.stringify({
    type: 'assistant',
    timestamp,
    message: {
      id,
      model,
      usage: {
        input_tokens: usage.input,
        output_tokens: usage.output,
        cache_read_input_tokens: usage.cacheRead,
        cache_creation_input_tokens: usage.cacheWrite5m + usage.cacheWrite1h,
        cache_creation: { ephemeral_5m_input_tokens: usage.cacheWrite5m, ephemeral_1h_input_tokens: usage.cacheWrite1h }
      }
    }
  })
}

export function localNoon(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day, 12, 0, 0).toISOString()
}

export function usageOfSize(size: number): FixtureUsage {
  return { input: size, output: size * 2, cacheRead: size * 3, cacheWrite5m: size * 4, cacheWrite1h: size * 5 }
}
