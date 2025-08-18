let debugEnabled = false

export function enableDebug(): void {
  debugEnabled = true
  // Also set environment variable for existing debug checks
  process.env.CLAUDE_TERM_DEBUG = 'true'
}

export function disableDebug(): void {
  debugEnabled = false
  delete process.env.CLAUDE_TERM_DEBUG
}

export function isDebugEnabled(): boolean {
  return debugEnabled || !!process.env.CLAUDE_TERM_DEBUG
}

export function debugLog(category: string, message: string, data?: any): void {
  if (!isDebugEnabled()) return

  const timestamp = new Date().toISOString()
  const prefix = `[DEBUG ${timestamp}] [${category}]`

  if (data !== undefined) {
    console.log(`${prefix} ${message}`, data)
  } else {
    console.log(`${prefix} ${message}`)
  }
}

export function logMCPMessage(direction: 'RECV' | 'SEND', message: any): void {
  if (!isDebugEnabled()) return

  const timestamp = new Date().toISOString()
  const arrow = direction === 'RECV' ? '←' : '→'

  console.log(`\n[MCP ${direction} ${timestamp}] ${arrow}`)
  console.log(JSON.stringify(message, null, 2))
  console.log('─'.repeat(80))
}

export function logWebSocketEvent(event: string, details?: any): void {
  if (!isDebugEnabled()) return

  const timestamp = new Date().toISOString()
  console.log(`\n[WS ${timestamp}] ${event}`)
  if (details) {
    console.log(JSON.stringify(details, null, 2))
  }
  console.log('─'.repeat(40))
}
