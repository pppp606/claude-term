# Prompt Sending API Design

## Overview

This document outlines the design for implementing prompt sending functionality in claude-term, allowing users to send messages and prompts directly to Claude Code from the terminal interface.

## Current Architecture Analysis

### Existing Components
- **CLI (`src/cli.ts`)**: Commander-based CLI with `sessions`, `start`, and `connect` commands
- **InteractiveSession (`src/interactive-session.ts`)**: WebSocket-based event handling with command processing
- **ConnectionClient (`src/connection-client.ts`)**: Session management and connection handling

### Current Command Pattern
Commands are prefixed with `:` and processed in `InteractiveSession.processCommand()`:
- `:help` - Show help
- `:send <path>` - Send file content
- `:browse` - Browse files with fzf
- `:cat <path>` - Display file
- `:search <pattern>` - Search code
- `:quit` - Exit session

## Proposed API Design

### 1. Command Interface

#### `:prompt <message>`
Send a direct prompt/message to Claude
```bash
> :prompt Explain the main function in this project
> :prompt How can I optimize this code for better performance?
```

#### `:ask <message>`
Alias for `:prompt` for more natural interaction
```bash
> :ask What does this function do?
> :ask Can you help me debug this error?
```

#### `:context <files...> <message>`
Send prompt with specific file context
```bash
> :context src/main.ts src/utils.ts Please review these files for potential bugs
> :context package.json What dependencies should I add for testing?
```

#### `:template <template_name> [args...]`
Use predefined prompt templates
```bash
> :template code_review src/feature.ts
> :template explain_error "TypeError: Cannot read property 'length' of undefined"
> :template optimize src/performance.ts
```

### 2. MCP Message Format

Based on research from OSS implementations, we'll use:

```typescript
interface PromptMessage {
  jsonrpc: '2.0';
  method: 'claude/sendPrompt';
  id: string;
  params: {
    message: string;
    context?: {
      files?: Array<{
        path: string;
        content: string;
      }>;
      selection?: {
        file: string;
        range: { start: number; end: number };
      };
      workspace?: string;
    };
    template?: string;
    metadata?: {
      timestamp: string;
      source: 'claude-term';
      version: string;
    };
  };
}
```

### 3. Implementation Strategy

#### Phase 1: Basic Prompt Sending
- Extend `InteractiveSession` with prompt sending methods
- Add `:prompt` and `:ask` commands
- Implement basic MCP message sending
- Add response handling and display

#### Phase 2: Context Integration  
- Add `:context` command for file-aware prompts
- Integrate with existing `:send` functionality
- Support multiple file selection
- Add workspace context awareness

#### Phase 3: Template System
- Create predefined prompt templates
- Add template configuration system
- Support custom user templates
- Implement template parameter substitution

#### Phase 4: Enhanced Features
- Conversation history tracking
- Response formatting and highlighting
- Async response handling
- Error recovery and retry mechanisms

## File Structure Changes

### New Files
```
src/
  prompt-sender.ts          # Core prompt sending logic
  template-manager.ts       # Template system
  conversation-history.ts   # History tracking
  types/
    prompt-types.ts         # TypeScript interfaces

docs/
  prompt-templates/         # Default templates
    code_review.md
    explain_error.md
    optimize.md
    
test/
  prompt-sender.test.ts
  template-manager.test.ts
  conversation-history.test.ts
```

### Modified Files
```
src/
  interactive-session.ts    # Add prompt commands
  cli.ts                   # Add prompt-related options
```

## MCP Integration Points

### Outbound Messages (Terminal → Claude)
- `claude/sendPrompt` - Send prompt with context
- `claude/sendMessage` - Simple message sending  
- `claude/requestContext` - Request additional context

### Inbound Messages (Claude → Terminal)
- `claude/promptResponse` - Response to sent prompts
- `claude/requestMoreContext` - Claude requests additional info
- `claude/conversationUpdate` - Update conversation state

## Error Handling Strategy

### Connection Errors
- Graceful degradation when MCP connection fails
- Queue messages for retry when connection restored
- Clear error messages with recovery suggestions

### Message Format Errors
- Validate MCP message structure before sending
- Handle malformed responses gracefully
- Fallback to basic text display for unknown formats

### Context Loading Errors
- Handle file read failures in context gathering
- Skip missing files with warnings
- Continue with partial context when some files unavailable

## Security Considerations

### File Access
- Respect workspace boundaries
- Validate file paths to prevent directory traversal
- Limit file size for context inclusion

### Message Content
- Sanitize user input before sending
- Prevent injection of malicious MCP commands
- Rate limiting for prompt sending

### Authentication
- Reuse existing MCP session authentication
- No additional authentication required

## User Experience

### Feedback and Progress
- Show typing indicators when Claude is processing
- Display response streaming in real-time
- Clear status messages for all operations

### Help and Discovery
- Enhanced `:help` with prompt examples
- Tab completion for template names
- Contextual suggestions based on current state

### Integration with Existing Workflow
- Seamless integration with current `:send`, `:browse`, `:cat` commands
- Natural command chaining (e.g., `:browse` → `:context` → `:prompt`)
- Consistent error handling and display patterns

## Testing Strategy

### Unit Tests
- `PromptSender` class methods
- Template parsing and substitution
- Message formatting and validation

### Integration Tests
- End-to-end prompt sending workflow
- Context gathering and file inclusion
- Template system with real templates

### Manual Testing
- Real Claude Code session interaction
- Various prompt types and contexts
- Error scenarios and edge cases

## Implementation Timeline

1. **Week 1**: Core prompt sending (`:prompt`, `:ask`)
2. **Week 2**: Context integration (`:context` command)
3. **Week 3**: Template system and predefined templates
4. **Week 4**: Enhanced features and polish

This design provides a solid foundation for implementing comprehensive prompt sending functionality while maintaining compatibility with the existing claude-term architecture.