import { describe, expect, test } from 'bun:test'
import { buildRule, isTooBroad, ORDER_PRESETS, RULE_MAX_LENGTH, toRule } from './rules'

describe('toRule', () => {
  test('a bare tool and a tool with a pattern are accepted', () => {
    expect(toRule('Bash(bun run check)')).toBe('Bash(bun run check)')
    expect(toRule('WebSearch')).toBe('WebSearch')
    expect(toRule('WebFetch(domain:example.com)')).toBe('WebFetch(domain:example.com)')
    expect(toRule('Read(./src/**)')).toBe('Read(./src/**)')
    expect(toRule('mcp__github__get_issue')).toBe('mcp__github__get_issue')
  })

  test('surrounding spaces are trimmed', () => {
    expect(toRule('  Bash(ls *) ')).toBe('Bash(ls *)')
  })

  test('a newline, a tab or any control character is refused', () => {
    expect(toRule('Bash(ls\n)')).toBeNull()
    expect(toRule('Bash(ls\t-la)')).toBeNull()
    expect(toRule('Bash(ls)\u0000')).toBeNull()
    expect(toRule('Bash(ls\r\nrm)')).toBeNull()
  })

  test('more than 200 characters is refused and exactly 200 is accepted', () => {
    const padding = 'a'.repeat(RULE_MAX_LENGTH - 'Bash()'.length)
    expect(toRule(`Bash(${padding})`)).toHaveLength(RULE_MAX_LENGTH)
    expect(toRule(`Bash(${padding}a)`)).toBeNull()
  })

  test('an unknown tool, a wrong case, an empty pattern and a broken shape are refused', () => {
    expect(toRule('Frobnicate(x)')).toBeNull()
    expect(toRule('bash(ls)')).toBeNull()
    expect(toRule('Bash()')).toBeNull()
    expect(toRule('Bash( )')).toBeNull()
    expect(toRule('Bash(ls')).toBeNull()
    expect(toRule('Bash ls')).toBeNull()
    expect(toRule('')).toBeNull()
    expect(toRule('mcp__github(x)')).toBeNull()
  })
})

describe('isTooBroad', () => {
  test('a bare Bash, Write or Edit is too broad but other bare tools are not', () => {
    for (const rule of ['Bash', 'Write', 'Edit']) {
      expect(isTooBroad(rule)).toBe(true)
    }
    for (const rule of ['WebSearch', 'Glob', 'Grep']) {
      expect(isTooBroad(rule)).toBe(false)
    }
  })

  test('a pattern that is only a wildcard is too broad', () => {
    for (const rule of ['Bash(*)', 'Write(*)', 'Edit(**)', 'Read(*)', 'Bash( * )', 'Bash(:*)']) {
      expect(isTooBroad(rule)).toBe(true)
    }
  })

  test('a Bash pattern starting with a risky command is too broad', () => {
    const risky = ['rm', 'sudo', 'git push', 'git reset', 'git clean', 'curl', 'wget', 'chmod', 'chown', 'dd', 'sh', 'bash', 'eval', 'powershell', 'cmd', 'del']
    for (const command of risky) {
      expect(isTooBroad(`Bash(${command})`)).toBe(true)
      expect(isTooBroad(`Bash(${command} *)`)).toBe(true)
      expect(isTooBroad(`Bash(${command}:*)`)).toBe(true)
      expect(isTooBroad(`Bash(${command}*)`)).toBe(true)
    }
  })

  test('case and extra spaces do not hide a risky command', () => {
    expect(isTooBroad('Bash(RM -rf build)')).toBe(true)
    expect(isTooBroad('Bash(git   push origin)')).toBe(true)
    expect(isTooBroad('Bash( sudo ls)')).toBe(true)
  })

  test('a leading wildcard in a shell pattern is too broad', () => {
    expect(isTooBroad('Bash(* --version)')).toBe(true)
  })

  test('safe patterns and commands that only share a prefix are not too broad', () => {
    for (const rule of ['Bash(bun test)', 'Bash(git status)', 'Bash(git diff *)', 'Bash(rmdir tmp)', 'Bash(shellcheck *)', 'Bash(git pull)', 'Read(./src/**)', 'WebFetch(domain:example.com)']) {
      expect(isTooBroad(rule)).toBe(false)
    }
  })

  test('a text that is not a rule is not reported as too broad', () => {
    expect(isTooBroad('nonsense')).toBe(false)
  })
})

const TOO_BROAD_ALLOW_RULES = [
  'Bash(zsh *)', 'Bash(fish *)', 'Bash(ksh *)', 'Bash(dash *)', 'Bash(env *)', 'Bash(xargs *)', 'Bash(nc *)', 'Bash(ssh *)',
  'Bash(npx *)', 'Bash(node *)', 'Bash(python *)', 'Bash(python3 *)', 'Bash(perl *)', 'Bash(ruby *)', 'Bash(bunx *)', 'Bash(bun x *)',
  'Bash(pwsh *)', 'Bash(powershell *)', 'Bash(cmd *)',
  'Bash(/bin/rm *)', 'Bash(/usr/bin/curl *)', 'Bash(C:\\Windows\\System32\\cmd.exe /c *)',
  'Bash(git *)', 'Bash(git:*)', 'Bash(git * main)', 'Bash(git -C . push *)', 'Bash(git -c core.pager=x log)', 'Bash(git push *)',
  'Bash(find *)', 'Bash(r*)', 'Bash(*m *)',
  'PowerShell(Remove-Item *)', 'PowerShell(iex *)', 'PowerShell(Invoke-Expression *)', 'PowerShell(pwsh *)',
  'Edit(//**)', 'Edit(//**/*)', 'Edit(**/*)', 'Edit(/**)', 'Edit(~/**)',
  'Edit(.claude/**)', 'Edit(./.claude/settings.json)', 'Write(.git/hooks/*)', 'NotebookEdit(**/.claude/*)', 'Edit(~/.claude/settings.json)', 'Edit(//**/.git/**)',
  'NotebookEdit', 'WebFetch', 'Read', 'Agent', 'Skill', 'PowerShell',
  'WebFetch(domain:*)', 'WebFetch(domain:*.com)',
  'Read(//**)', 'Read(~/.ssh/**)'
]

const ALLOWED_RULES = [
  'Bash(bun run check)', 'Bash(bun test)', 'Bash(bun run typecheck)', 'Bash(npm test)', 'Bash(git status)', 'Bash(git diff *)', 'Bash(git log *)',
  'Edit(src/**)', 'Read(./src/**)', 'WebFetch(domain:example.com)', 'WebFetch(domain:*.example.com)', 'Agent(Explore)', 'Skill(commit)'
]

describe('isTooBroad table', () => {
  test.each(TOO_BROAD_ALLOW_RULES)('%s is too broad', (rule) => {
    expect(toRule(rule)).toBe(rule)
    expect(isTooBroad(rule)).toBe(true)
  })

  test.each(ALLOWED_RULES)('%s is allowed', (rule) => {
    expect(isTooBroad(rule)).toBe(false)
  })
})

describe('presets', () => {
  test('every preset is a valid rule and none is too broad', () => {
    expect(ORDER_PRESETS.length).toBeGreaterThan(0)
    for (const preset of ORDER_PRESETS) {
      expect(toRule(preset.rule)).toBe(preset.rule)
      expect(isTooBroad(preset.rule)).toBe(false)
    }
  })
})

describe('buildRule', () => {
  test('an empty pattern gives the bare tool', () => {
    expect(buildRule('Bash', ' ')).toBe('Bash')
    expect(buildRule('Bash', ' bun test ')).toBe('Bash(bun test)')
  })
})
