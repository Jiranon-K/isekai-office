import { describe, expect, test } from 'bun:test'
import {
  claudeStreamArgs,
  encodeControlResponse,
  encodeInterrupt,
  encodeUserPrompt,
  formatPermissionScreen,
  parseStreamLine
} from './protocol'

describe('managed protocol encoders', () => {
  test('encodes user prompt, allow/deny control responses, interrupt, and CLI args', () => {
    expect(JSON.parse(encodeUserPrompt('fix auth'))).toEqual({
      type: 'user',
      message: { role: 'user', content: 'fix auth' }
    })
    expect(JSON.parse(encodeControlResponse('req-1', true))).toEqual({
      type: 'control_response',
      response: { subtype: 'success', request_id: 'req-1', response: { behavior: 'allow' } }
    })
    expect(JSON.parse(encodeControlResponse('req-2', false))).toEqual({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: 'req-2',
        response: { behavior: 'deny', message: 'Denied from Isekai Office' }
      }
    })
    expect(JSON.parse(encodeInterrupt('int-1'))).toEqual({
      type: 'control_request',
      request_id: 'int-1',
      request: { subtype: 'interrupt' }
    })
    expect(claudeStreamArgs('uuid-123')).toContain('--permission-prompts')
    expect(claudeStreamArgs('uuid-123')).toContain('uuid-123')
  })

  test('formats concise permission screen lines', () => {
    const screen = formatPermissionScreen('Bash', { command: 'bun test' })
    expect(screen).toContain('⏺ Bash(bun test)')
    expect(screen).toContain('Do you want to proceed?')
    expect(screen).toContain('❯ 1. Yes')
  })
})

describe('parseStreamLine', () => {
  test('parses system, assistant, control_request, result, and ignores unknown or invalid lines', () => {
    expect(parseStreamLine(JSON.stringify({ type: 'system', session_id: 's-1', cwd: '/repo/app' }))).toEqual({
      kind: 'system',
      sessionId: 's-1',
      cwd: '/repo/app'
    })
    expect(
      parseStreamLine(
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'Checking tests' },
              { type: 'tool_use', name: 'Edit', input: { file_path: 'src/a.ts' } }
            ],
            usage: { input_tokens: 100, cache_read_input_tokens: 50 }
          }
        })
      )
    ).toEqual({
      kind: 'assistant',
      text: 'Checking tests',
      tools: ['Edit'],
      contextTokens: 150
    })

    const control = parseStreamLine(
      JSON.stringify({
        type: 'control_request',
        request_id: 'req-9',
        request: { subtype: 'can_use_tool', tool_name: 'Bash', input: { command: 'rm -rf dist' } }
      })
    )
    expect(control.kind).toBe('control_request')
    if (control.kind === 'control_request') {
      expect(control.requestId).toBe('req-9')
      expect(control.toolName).toBe('Bash')
      expect(control.screen).toContain('⏺ Bash(rm -rf dist)')
    }

    expect(parseStreamLine(JSON.stringify({ type: 'result', result: 'All green', is_error: false }))).toEqual({
      kind: 'result',
      text: 'All green',
      isError: false
    })
    expect(parseStreamLine('not-json')).toEqual({ kind: 'ignored' })
    expect(parseStreamLine(JSON.stringify({ type: 'other' }))).toEqual({ kind: 'ignored' })
  })
})
