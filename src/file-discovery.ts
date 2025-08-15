import fs from 'fs/promises'
import path from 'path'

export interface FileInfo {
  absolutePath: string
  relativePath: string
  name: string
  extension: string
  directory: string
  size: number
  lastModified: Date
}

export class FileDiscovery {
  private gitignorePatterns: string[] = []

  async scanFiles(rootDir: string): Promise<FileInfo[]> {
    try {
      await fs.access(rootDir)
    } catch {
      return []
    }

    this.gitignorePatterns = await this.loadGitignorePatterns(rootDir)
    const files: FileInfo[] = []
    await this.scanDirectory(rootDir, rootDir, files)
    return files
  }

  private async loadGitignorePatterns(rootDir: string): Promise<string[]> {
    try {
      const gitignorePath = path.join(rootDir, '.gitignore')
      const content = await fs.readFile(gitignorePath, 'utf-8')
      return content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
    } catch {
      return []
    }
  }

  private async scanDirectory(
    rootDir: string,
    currentDir: string,
    files: FileInfo[],
  ): Promise<void> {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        const relativePath = path.relative(rootDir, fullPath)

        if (this.isIgnored(relativePath)) {
          continue
        }

        if (entry.isDirectory()) {
          await this.scanDirectory(rootDir, fullPath, files)
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath)
          const fileInfo: FileInfo = {
            absolutePath: fullPath,
            relativePath: relativePath,
            name: entry.name,
            extension: path.extname(entry.name),
            directory: path.relative(rootDir, path.dirname(fullPath)) || '.',
            size: stats.size,
            lastModified: new Date(stats.mtime),
          }
          files.push(fileInfo)
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }

  private isIgnored(relativePath: string): boolean {
    // Always ignore .git directory
    if (relativePath.startsWith('.git/') || relativePath === '.git') {
      return true
    }

    for (const pattern of this.gitignorePatterns) {
      if (this.matchesGitignorePattern(relativePath, pattern)) {
        return true
      }
    }
    return false
  }

  private matchesGitignorePattern(filePath: string, pattern: string): boolean {
    // Handle directory patterns ending with /
    if (pattern.endsWith('/')) {
      const dirPattern = pattern.slice(0, -1)
      return filePath.startsWith(dirPattern + '/') || filePath === dirPattern
    }

    // Handle glob patterns
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*')
      const regex = new RegExp(`^${regexPattern}$`)
      return regex.test(filePath) || regex.test(path.basename(filePath))
    }

    // Exact match or directory match
    return filePath === pattern || filePath.startsWith(pattern + '/')
  }
}
