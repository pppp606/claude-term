import { TemplateManager } from './template-manager.js'
import { PromptTemplate } from './types/prompt-types.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('TemplateManager', () => {
  let tempDir: string
  let templateManager: TemplateManager

  beforeEach(() => {
    // Create a temporary directory for test templates
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-term-templates-'))
    templateManager = new TemplateManager(tempDir)
  })

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true })
    }
  })

  describe('loadTemplates', () => {
    it('should load templates from markdown files', () => {
      const templateContent = `# Test Template

**Name**: test_template  
**Description**: A test template

## Template

Hello {name}, please {action}.

## Parameters
- \`{name}\` - The name to use
- \`{action}\` - The action to perform
`

      fs.writeFileSync(path.join(tempDir, 'test_template.md'), templateContent)
      
      // Create a new manager to trigger loading
      const manager = new TemplateManager(tempDir)
      const templates = manager.listTemplates()
      
      expect(templates).toHaveLength(1)
      expect(templates[0]).toMatchObject({
        name: 'test_template',
        description: 'A test template',
        template: 'Hello {name}, please {action}.',
        parameters: ['name', 'action']
      })
    })

    it('should handle non-existent template directory gracefully', () => {
      const manager = new TemplateManager('/non/existent/path')
      expect(manager.listTemplates()).toHaveLength(0)
    })

    it('should handle malformed template files gracefully', () => {
      fs.writeFileSync(path.join(tempDir, 'bad_template.md'), 'invalid template content')
      
      const manager = new TemplateManager(tempDir)
      const templates = manager.listTemplates()
      
      expect(templates).toHaveLength(1)
      // Should still create a template with filename as name
      expect(templates[0].name).toBe('bad_template')
    })
  })

  describe('getTemplate', () => {
    beforeEach(() => {
      const templateContent = `# Test Template

**Name**: test_template  
**Description**: A test template

## Template

Hello {name}!
`

      fs.writeFileSync(path.join(tempDir, 'test_template.md'), templateContent)
      templateManager = new TemplateManager(tempDir)
    })

    it('should return template by name', () => {
      const template = templateManager.getTemplate('test_template')
      
      expect(template).toBeDefined()
      expect(template?.name).toBe('test_template')
      expect(template?.description).toBe('A test template')
    })

    it('should return undefined for non-existent template', () => {
      const template = templateManager.getTemplate('non_existent')
      expect(template).toBeUndefined()
    })
  })

  describe('hasTemplate', () => {
    beforeEach(() => {
      const templateContent = `# Test Template
**Name**: test_template
**Description**: A test template
## Template
Hello!`

      fs.writeFileSync(path.join(tempDir, 'test_template.md'), templateContent)
      templateManager = new TemplateManager(tempDir)
    })

    it('should return true for existing template', () => {
      expect(templateManager.hasTemplate('test_template')).toBe(true)
    })

    it('should return false for non-existent template', () => {
      expect(templateManager.hasTemplate('non_existent')).toBe(false)
    })
  })

  describe('substituteParameters', () => {
    it('should replace parameter placeholders with values', () => {
      const template: PromptTemplate = {
        name: 'test',
        description: 'test',
        template: 'Hello {name}, please {action} the {item}.',
        parameters: ['name', 'action', 'item']
      }

      const result = templateManager.substituteParameters(template, {
        name: 'Alice',
        action: 'review',
        item: 'code'
      })

      expect(result).toBe('Hello Alice, please review the code.')
    })

    it('should handle missing parameters gracefully', () => {
      const template: PromptTemplate = {
        name: 'test',
        description: 'test',
        template: 'Hello {name}, {greeting}!',
        parameters: ['name', 'greeting']
      }

      const result = templateManager.substituteParameters(template, {
        name: 'Alice'
        // greeting is missing
      })

      expect(result).toBe('Hello Alice, {greeting}!')
    })

    it('should handle extra parameters gracefully', () => {
      const template: PromptTemplate = {
        name: 'test',
        description: 'test',
        template: 'Hello {name}!',
        parameters: ['name']
      }

      const result = templateManager.substituteParameters(template, {
        name: 'Alice',
        extra: 'unused' // extra parameter
      })

      expect(result).toBe('Hello Alice!')
    })
  })

  describe('getTemplateUsage', () => {
    beforeEach(() => {
      const templateContent = `# Test Template

**Name**: test_template  
**Description**: A test template with parameters

## Template

Hello {name}, please {action}.

## Parameters
- \`{name}\` - The name to use
- \`{action}\` - The action to perform
`

      fs.writeFileSync(path.join(tempDir, 'test_template.md'), templateContent)
      templateManager = new TemplateManager(tempDir)
    })

    it('should return usage information for existing template', () => {
      const usage = templateManager.getTemplateUsage('test_template')
      
      expect(usage).toContain('Template: test_template')
      expect(usage).toContain('Description: A test template with parameters')
      expect(usage).toContain('Parameters:')
      expect(usage).toContain('{name}')
      expect(usage).toContain('{action}')
      expect(usage).toContain('Usage: :template test_template param1=value1 param2=value2')
    })

    it('should return null for non-existent template', () => {
      const usage = templateManager.getTemplateUsage('non_existent')
      expect(usage).toBeNull()
    })
  })
})