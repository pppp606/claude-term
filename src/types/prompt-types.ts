export interface PromptContext {
  files?: Array<{
    path: string
    content: string
  }>
  selection?: {
    file: string
    range: { start: number; end: number }
  }
  workspace?: string
}

export interface PromptMessage {
  jsonrpc: '2.0'
  method: 'claude/sendPrompt'
  id: string
  params: {
    message: string
    context?: PromptContext
    template?: string
    metadata?: {
      timestamp: string
      source: 'claude-term'
      version: string
    }
  }
}

export interface PromptResponse {
  jsonrpc: '2.0'
  id: string
  result?: {
    response: string
    conversationId?: string
  }
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

export interface PromptTemplate {
  name: string
  description: string
  template: string
  parameters?: string[]
}
