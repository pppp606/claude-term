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
    const session1 = { port: 8080, context: 'project1', project: '/path/to/project1' }
    const session2 = { port: 8081, context: 'project2', project: '/path/to/project2' }

    fs.writeFileSync(path.join(tempDir, 'claude-session1.lock'), JSON.stringify(session1))
    fs.writeFileSync(path.join(tempDir, 'claude-session2.lock'), JSON.stringify(session2))

    const output = execSync(`node ${cliPath} sessions --lock-dir="${tempDir}"`, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    expect(output).toContain('Found 2 Claude Code sessions:')
    expect(output).toContain('Port: 8080, Context: project1, Project: /path/to/project1')
    expect(output).toContain('Port: 8081, Context: project2, Project: /path/to/project2')
  })

  it('should ignore invalid lock files', () => {
    const validSession = { port: 8080, context: 'valid', project: '/valid/project' }

    fs.writeFileSync(path.join(tempDir, 'claude-valid.lock'), JSON.stringify(validSession))
    fs.writeFileSync(path.join(tempDir, 'claude-invalid.lock'), 'invalid json')

    const output = execSync(`node ${cliPath} sessions --lock-dir="${tempDir}"`, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    expect(output).toContain('Found 1 Claude Code session:')
    expect(output).toContain('Port: 8080, Context: valid, Project: /valid/project')
  })

  it('should use /tmp as default directory when no --lock-dir provided', () => {
    const output = execSync(`node ${cliPath} sessions`, {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    expect(output).toMatch(/(No Claude Code sessions found\.|Found \d+ Claude Code session)/)
  })
})
