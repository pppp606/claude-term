import { execSync } from 'child_process'
import path from 'path'

describe('CLI', () => {
  const cliPath = path.join(__dirname, '..', 'dist', 'cli.js')

  it('should show help when no command provided', () => {
    const output = execSync(`node ${cliPath}`, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    expect(output).toContain('Minimal IDE server for Claude Code')
    expect(output).toContain('Commands:')
    expect(output).toContain('start')
  })

  it('should show version information', () => {
    const output = execSync(`node ${cliPath} --version`, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    expect(output.trim()).toBe('0.0.1')
  })
})
