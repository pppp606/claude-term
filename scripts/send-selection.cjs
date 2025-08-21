#!/usr/bin/env node

console.log('📤 Script executed with:', process.argv[2]);

const fs = require('fs');

// Parse command line arguments (only line is Base64 encoded)
const encodedLine = process.argv[2] || '';
console.log('Encoded line:', encodedLine);

const line = Buffer.from(encodedLine, 'base64').toString('utf8');
const filePath = process.argv[3];
const port = process.argv[4];
const authToken = process.argv[5];

console.log('Processing line:', line);
console.log('File path:', filePath);
console.log('Port:', port);
console.log('Auth token:', authToken ? authToken.substring(0, 8) + '...' : 'undefined');

const match = line.match(/^\s*(\d+):/);
if (!match) {
  console.log('No line number match found');
  process.exit(0);
}

const lineNumber = parseInt(match[1]) - 1;
console.log('Line number:', lineNumber);

try {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const selectedText = lines[lineNumber];
  
  console.log('Selected text:', selectedText.substring(0, 50) + '...');

  const message = {
    jsonrpc: '2.0',
    method: 'selection_changed',
    params: {
      filePath: filePath,
      selection: {
        start: { line: lineNumber, character: 0 },
        end: { line: lineNumber, character: selectedText.length }
      },
      text: content,
      selectedText: selectedText
    }
  };

  // Write message to file for main process to pick up
  const requestFile = `/tmp/claude-term-realtime-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;
  fs.writeFileSync(requestFile, JSON.stringify(message));
  console.log('📤 Wrote selection to file:', requestFile);
  console.log('📤 Main process will send line ' + (lineNumber + 1) + ' to Claude Code');
  
} catch (e) {
  console.error('Script error:', e.message);
}
