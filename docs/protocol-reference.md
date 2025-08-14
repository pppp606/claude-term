# MCP Protocol Reference

## Overview

This document provides a comprehensive reference for Model Context Protocol (MCP) methods and events available for Claude Code integration, based on analysis of OSS implementations and the official MCP specification.

## Core MCP Architecture

### Transport Layer
- **WebSocket**: Real-time bidirectional communication
- **HTTP**: Request/response pattern for stateless operations
- **Stdio**: Standard input/output for local process communication

### Message Types
- **Request**: Client-initiated messages expecting responses
- **Notification**: One-way messages with no expected response
- **Response**: Server replies to request messages

## Available MCP Methods

### 1. File Operations

#### `read`
**Purpose**: Read file contents
```typescript
interface ReadRequest {
  method: 'read';
  params: {
    uri: string;
    range?: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  };
}
```

#### `write` 
**Purpose**: Write content to files
```typescript
interface WriteRequest {
  method: 'write';
  params: {
    uri: string;
    content: string;
  };
}
```

#### `edit`
**Purpose**: Make targeted edits to files
```typescript
interface EditRequest {
  method: 'edit';
  params: {
    uri: string;
    edits: Array<{
      range: Range;
      newText: string;
    }>;
  };
}
```

#### `multi_edit`
**Purpose**: Apply multiple edits across files
```typescript
interface MultiEditRequest {
  method: 'multi_edit';
  params: {
    edits: Record<string, Array<{
      range: Range;
      newText: string;
    }>>;
  };
}
```

### 2. Shell & System Integration

#### `run_command`
**Purpose**: Execute shell commands
```typescript
interface RunCommandRequest {
  method: 'run_command';
  params: {
    command: string;
    args: string[];
    cwd?: string;
    env?: Record<string, string>;
  };
}
```

#### `git_operation`
**Purpose**: Perform git operations
```typescript
interface GitOperationRequest {
  method: 'git_operation';
  params: {
    operation: 'status' | 'add' | 'commit' | 'push' | 'pull';
    args?: string[];
  };
}
```

### 3. IDE Integration

#### `openFile`
**Purpose**: Open file in IDE
```typescript
interface OpenFileRequest {
  method: 'openFile';
  params: {
    uri: string;
    line?: number;
    column?: number;
  };
}
```

#### `openDiff`
**Purpose**: Open diff view in IDE
```typescript
interface OpenDiffRequest {
  method: 'openDiff';
  params: {
    original: string;
    modified: string;
    title?: string;
  };
}
```

#### `getCurrentSelection`
**Purpose**: Get current text selection
```typescript
interface GetCurrentSelectionRequest {
  method: 'getCurrentSelection';
}
```

### 4. Context Management

#### `getWorkspaceFolders`
**Purpose**: Retrieve workspace folder information
```typescript
interface GetWorkspaceFoldersRequest {
  method: 'getWorkspaceFolders';
}
```

#### `getDiagnostics`
**Purpose**: Get diagnostic information
```typescript
interface GetDiagnosticsRequest {
  method: 'getDiagnostics';
  params: {
    uri?: string;
  };
}
```

### 5. Advanced Features

#### `dispatch_agent`
**Purpose**: Delegate tasks to specialized agents
```typescript
interface DispatchAgentRequest {
  method: 'dispatch_agent';
  params: {
    agent_type: string;
    task: string;
    context?: Record<string, any>;
  };
}
```

#### `think`
**Purpose**: Structured reasoning and analysis
```typescript
interface ThinkRequest {
  method: 'think';
  params: {
    prompt: string;
    context?: Record<string, any>;
  };
}
```

## Event-Driven Communication

### Beyond `at_mentioned`

#### `claude/provideEdits`
**Purpose**: Receive edit proposals from Claude
```typescript
interface ProvideEditsEvent {
  method: 'claude/provideEdits';
  params: {
    edits: Array<{
      uri: string;
      changes: Array<{
        range: Range;
        newText: string;
      }>;
    }>;
  };
}
```

#### `claude/requestContext`
**Purpose**: Claude requests additional context
```typescript
interface RequestContextEvent {
  method: 'claude/requestContext';
  params: {
    type: 'file' | 'selection' | 'workspace';
    uri?: string;
  };
}
```

#### `claude/sendMessage`
**Purpose**: Send messages/prompts to Claude
```typescript
interface SendMessageRequest {
  method: 'claude/sendMessage';
  params: {
    message: string;
    context?: {
      files?: string[];
      selection?: Range;
      workspace?: string;
    };
  };
}
```

## Prompt Sending Mechanisms

### Direct Prompt Injection
Based on analysis of `steipete/claude-code-mcp`:
- Single tool approach: `claude_code` method
- Direct command execution bypassing UI
- Minimal overhead for automation

### Structured Tool Invocation
Based on analysis of `SDGLBL/mcp-claude-code`:
- Multiple specialized tools
- Context-aware operations
- Enhanced security model

### Bidirectional Communication
Based on analysis of `coder/claudecode.nvim`:
- Real-time WebSocket connection
- Event-driven architecture  
- State synchronization

## Implementation Patterns

### 1. One-Shot Execution
```typescript
// Simple prompt sending
const response = await mcpClient.request({
  method: 'claude_code',
  params: {
    command: 'send_prompt',
    prompt: 'Explain this code',
    context: { file: 'src/main.ts' }
  }
});
```

### 2. Session-Based Communication
```typescript
// Persistent session with context
class MCPSession {
  async sendPrompt(message: string, context?: any) {
    return await this.client.request({
      method: 'claude/sendMessage',
      params: { message, context }
    });
  }
}
```

### 3. Event-Driven Interaction
```typescript
// Listen for Claude events and respond
mcpClient.on('claude/provideEdits', (event) => {
  // Handle edit proposals
  this.handleEdits(event.params.edits);
});
```

## Security Considerations

- **Permission Model**: Most implementations use capability-based security
- **Sandbox Restrictions**: File access limited to workspace
- **Command Filtering**: Shell commands may be restricted
- **Authentication**: Token-based authentication for remote connections

## Error Handling

### Standard Error Codes
- `-32700`: Parse error
- `-32600`: Invalid request
- `-32601`: Method not found
- `-32602`: Invalid params
- `-32603`: Internal error

### Custom Error Codes
- `1001`: File not found
- `1002`: Permission denied
- `1003`: Invalid workspace
- `1004`: Command execution failed

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Claude Code MCP Server](https://github.com/anthropics/mcp-claude-code)
- OSS Implementation Analysis (see `docs/oss-claude-code-implementations.md`)