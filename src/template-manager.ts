import fs from 'fs'
import path from 'path'
import { PromptTemplate } from './types/prompt-types.js'

export class TemplateManager {
  private templates: Map<string, PromptTemplate> = new Map()
  private templatesDir: string

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || path.join(process.cwd(), 'docs', 'prompt-templates')
    this.loadTemplates()
  }

  private loadTemplates(): void {
    try {
      if (!fs.existsSync(this.templatesDir)) {
        console.warn(`Templates directory not found: ${this.templatesDir}`)
        return
      }

      const templateFiles = fs.readdirSync(this.templatesDir).filter(file => file.endsWith('.md'))

      for (const file of templateFiles) {
        const templatePath = path.join(this.templatesDir, file)
        const content = fs.readFileSync(templatePath, 'utf8')
        const template = this.parseTemplate(content, file)
        
        if (template) {
          this.templates.set(template.name, template)
        }
      }

      console.log(`Loaded ${this.templates.size} templates`)
    } catch (error) {
      console.warn('Error loading templates:', error)
    }
  }

  private parseTemplate(content: string, filename: string): PromptTemplate | null {
    try {
      // Extract metadata from markdown
      const lines = content.split('\n')
      let name = path.basename(filename, '.md')
      let description = ''
      let templateText = ''
      let parameters: string[] = []

      let inTemplateSection = false
      let inParametersSection = false

      for (const line of lines) {
        if (line.startsWith('**Name**:')) {
          name = line.replace('**Name**:', '').trim()
        } else if (line.startsWith('**Description**:')) {
          description = line.replace('**Description**:', '').trim()
        } else if (line.includes('## Template')) {
          inTemplateSection = true
          continue
        } else if (line.includes('## Parameters')) {
          inTemplateSection = false
          inParametersSection = true
          continue
        } else if (line.startsWith('## ') && inTemplateSection) {
          // End of template section
          inTemplateSection = false
        }

        if (inTemplateSection && line.trim()) {
          templateText += line + '\n'
        } else if (inParametersSection && line.trim().startsWith('- `{')) {
          // Extract parameter name from markdown list item like "- `{error}` - Description"
          const match = line.match(/- `\{([^}]+)\}`/)
          if (match) {
            parameters.push(match[1])
          }
        }
      }

      return {
        name,
        description,
        template: templateText.trim(),
        parameters
      }
    } catch (error) {
      console.warn(`Error parsing template ${filename}:`, error)
      return null
    }
  }

  public getTemplate(name: string): PromptTemplate | undefined {
    return this.templates.get(name)
  }

  public listTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values())
  }

  public hasTemplate(name: string): boolean {
    return this.templates.has(name)
  }

  public substituteParameters(template: PromptTemplate, parameters: Record<string, string>): string {
    let result = template.template

    // Replace parameter placeholders with values
    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = `{${key}}`
      result = result.split(placeholder).join(value)
    }

    return result
  }

  public getTemplateUsage(templateName: string): string | null {
    const template = this.getTemplate(templateName)
    if (!template) {
      return null
    }

    let usage = `Template: ${template.name}\n`
    usage += `Description: ${template.description}\n`
    
    if (template.parameters && template.parameters.length > 0) {
      usage += '\nParameters:\n'
      for (const param of template.parameters) {
        usage += `  {${param}}\n`
      }
      usage += '\nUsage: :template ' + templateName + ' param1=value1 param2=value2'
    } else {
      usage += '\nUsage: :template ' + templateName
    }

    return usage
  }
}