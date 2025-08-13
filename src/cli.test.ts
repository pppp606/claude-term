import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('CLI sessions command', () => {
  let tempDir: string
  const cliPath = path.join(__dirname, '..', 'dist', 'cli.js')

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-term-cli-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should output empty list when no sessions exist', () => {
    const output = execSync(`node ${cliPath} sessions --lock-dir="${tempDir}"`, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    expect(output.trim()).toBe('No Claude Code sessions found.')
  })

  it('should output session list when sessions exist', () => {
    const session1Data = {
      pid: 12345,
      workspaceFolders: ['/path/to/project1'],
      ideName: 'Cursor',
      transport: 'ws',
      runningInWindows: false,
      authToken: 'token1',
    }
    const session2Data = {
      pid: 12346,
      workspaceFolders: ['/path/to/project2'],
      ideName: 'Cursor',
      transport: 'ws',
      runningInWindows: false,
      authToken: 'token2',
    }

    fs.writeFileSync(path.join(tempDir, '8080.lock'), JSON.stringify(session1Data))
    fs.writeFileSync(path.join(tempDir, '8081.lock'), JSON.stringify(session2Data))

    const output = execSync(`node ${cliPath} sessions --lock-dir="${tempDir}"`, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    expect(output).toContain('Found 2 Claude Code sessions (current project context):')
    expect(output).toContain('Port: 8080, PID: 12345, IDE: Cursor, Workspaces: /path/to/project1')
    expect(output).toContain('Port: 8081, PID: 12346, IDE: Cursor, Workspaces: /path/to/project2')
  })

  it('should ignore invalid lock files', () => {
    const validSessionData = {
      pid: 12345,
      workspaceFolders: ['/valid/project'],
      ideName: 'Cursor',
      transport: 'ws',
      runningInWindows: false,
      authToken: 'valid-token',
    }

    fs.writeFileSync(path.join(tempDir, '8080.lock'), JSON.stringify(validSessionData))
    fs.writeFileSync(path.join(tempDir, '8081.lock'), 'invalid json')

    const output = execSync(`node ${cliPath} sessions --lock-dir="${tempDir}"`, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    expect(output).toContain('Found 1 Claude Code session (current project context):')
    expect(output).toContain('Port: 8080, PID: 12345, IDE: Cursor, Workspaces: /valid/project')
  })

  it('should use ~/.claude/ide as default directory when no --lock-dir provided', () => {
    const output = execSync(`node ${cliPath} sessions`, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    expect(output).toMatch(/(No Claude Code sessions found\.|Found \d+ Claude Code session)/)
  })
})
