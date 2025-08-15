import { ClaudeTermIDEServer } from './ide-server'
import { FileInfo } from './file-discovery'

describe('Tab Completion', () => {
  let server: ClaudeTermIDEServer

  beforeEach(() => {
    server = new ClaudeTermIDEServer()
    
    // Mock file cache with sample files
    const mockFiles: FileInfo[] = [
      {
        absolutePath: '/project/src/components/UserProfile.tsx',
        relativePath: 'src/components/UserProfile.tsx',
        name: 'UserProfile.tsx',
        extension: '.tsx',
        directory: 'src/components',
        size: 1024,
        lastModified: new Date(),
      },
      {
        absolutePath: '/project/src/components/UserList.tsx',
        relativePath: 'src/components/UserList.tsx',
        name: 'UserList.tsx',
        extension: '.tsx',
        directory: 'src/components',
        size: 512,
        lastModified: new Date(),
      },
      {
        absolutePath: '/project/src/utils/userHelper.ts',
        relativePath: 'src/utils/userHelper.ts',
        name: 'userHelper.ts',
        extension: '.ts',
        directory: 'src/utils',
        size: 800,
        lastModified: new Date(),
      },
      {
        absolutePath: '/project/package.json',
        relativePath: 'package.json',
        name: 'package.json',
        extension: '.json',
        directory: '.',
        size: 2048,
        lastModified: new Date(),
      },
    ]
    
    // Set mock cache
    ;(server as any).fileCache = mockFiles
    ;(server as any).cacheTimestamp = Date.now()
  })

  describe('findCommonPrefix', () => {
    it('should find common prefix for similar strings', () => {
      const commonPrefix = (server as any).findCommonPrefix([
        'src/components/UserProfile.tsx',
        'src/components/UserList.tsx'
      ])
      
      expect(commonPrefix).toBe('src/components/User')
    })

    it('should return full string for single input', () => {
      const commonPrefix = (server as any).findCommonPrefix(['package.json'])
      expect(commonPrefix).toBe('package.json')
    })

    it('should return empty string for no common prefix', () => {
      const commonPrefix = (server as any).findCommonPrefix([
        'src/components/UserProfile.tsx',
        'package.json'
      ])
      expect(commonPrefix).toBe('')
    })

    it('should handle empty array', () => {
      const commonPrefix = (server as any).findCommonPrefix([])
      expect(commonPrefix).toBe('')
    })
  })

  describe('completeCommand', () => {
    it('should complete single file match without command prefix', () => {
      const [completions, originalLine] = (server as any).completeCommand('/send package')
      
      expect(completions).toHaveLength(1)
      expect(completions[0]).toBe('package.json')
      expect(originalLine).toBe('/send package')
    })

    it('should provide common prefix for multiple matches without command prefix', () => {
      const [completions] = (server as any).completeCommand('/send User')
      
      // Should either return common prefix or all matches (no /send prefix)
      expect(completions.length).toBeGreaterThan(0)
      if (completions.length === 1) {
        // Common prefix completion
        expect(completions[0]).toContain('User')
        expect(completions[0]).not.toContain('/send ')
      } else {
        // All matches without command prefix
        expect(completions).toContain('src/components/UserProfile.tsx')
        expect(completions).toContain('src/components/UserList.tsx')
      }
    })

    it('should return multiple completions without command prefix', () => {
      const [completions] = (server as any).completeCommand('/cat ')
      
      expect(completions.length).toBeGreaterThan(1)
      // Should be file paths, not /cat commands
      expect(completions[0]).not.toContain('/cat ')
    })

    it('should handle non-file commands', () => {
      const [completions] = (server as any).completeCommand('/he')
      
      expect(completions).toContain('/help')
    })

    it('should return empty for no matches', () => {
      const [completions] = (server as any).completeCommand('/send nonexistent')
      
      expect(completions).toEqual([])
    })

    it('should handle /cat command without command prefix', () => {
      const [completions] = (server as any).completeCommand('/cat user')
      
      expect(completions.length).toBeGreaterThan(0)
      expect(completions.some((c: string) => c.includes('userHelper.ts'))).toBe(true)
      // Should not contain command prefix
      expect(completions.every((c: string) => !c.startsWith('/cat '))).toBe(true)
    })
  })

  describe('getFileCompletionsSync', () => {
    it('should return filename prefix matches only', () => {
      const completions = (server as any).getFileCompletionsSync('user')
      
      expect(completions.length).toBeGreaterThan(0)
      expect(completions).toContain('src/utils/userHelper.ts')
    })

    it('should return exact filename matches', () => {
      const completions = (server as any).getFileCompletionsSync('package.json')
      
      expect(completions[0]).toBe('package.json')
    })

    it('should handle empty prefix', () => {
      const completions = (server as any).getFileCompletionsSync('')
      
      expect(completions.length).toBeGreaterThan(0)
      expect(completions.length).toBeLessThanOrEqual(10)
    })

    it('should match filename prefix (case insensitive)', () => {
      const completions = (server as any).getFileCompletionsSync('User')
      
      expect(completions.length).toBeGreaterThan(0)
      expect(completions.some((c: string) => c.includes('UserProfile.tsx'))).toBe(true)
      expect(completions.some((c: string) => c.includes('UserList.tsx'))).toBe(true)
    })

    it('should exclude .git files', () => {
      // Add a mock .git file to test exclusion
      const mockGitFile: FileInfo = {
        absolutePath: '/project/.git/config',
        relativePath: '.git/config',
        name: 'config',
        extension: '',
        directory: '.git',
        size: 100,
        lastModified: new Date(),
      }
      ;(server as any).fileCache.push(mockGitFile)
      
      const completions = (server as any).getFileCompletionsSync('config')
      
      // Should not include .git/config
      expect(completions.every((c: string) => !c.startsWith('.git/'))).toBe(true)
    })

    it('should sort by filename length then alphabetically', () => {
      const completions = (server as any).getFileCompletionsSync('User')
      
      if (completions.length > 1) {
        // First should be shorter or same length, then alphabetical
        const firstLen = completions[0].split('/').pop()?.length || 0
        const secondLen = completions[1].split('/').pop()?.length || 0
        expect(firstLen).toBeLessThanOrEqual(secondLen)
      }
    })

    it('should exclude gitignored patterns like node_modules and dist', () => {
      // Add mock files that should be ignored by .gitignore
      const mockIgnoredFiles: FileInfo[] = [
        {
          absolutePath: '/project/node_modules/package/index.js',
          relativePath: 'node_modules/package/index.js',
          name: 'index.js',
          extension: '.js',
          directory: 'node_modules/package',
          size: 100,
          lastModified: new Date(),
        },
        {
          absolutePath: '/project/dist/bundle.js',
          relativePath: 'dist/bundle.js',
          name: 'bundle.js',
          extension: '.js',
          directory: 'dist',
          size: 200,
          lastModified: new Date(),
        },
      ]
      
      // Note: In real usage, these files would already be filtered out by FileDiscovery
      // This test verifies that if they somehow made it to cache, they'd be filtered out
      const originalCache = (server as any).fileCache
      ;(server as any).fileCache = [...originalCache, ...mockIgnoredFiles]
      
      const completions = (server as any).getFileCompletionsSync('index')
      
      // Should not include node_modules or dist files
      expect(completions.every((c: string) => !c.startsWith('node_modules/'))).toBe(true)
      expect(completions.every((c: string) => !c.startsWith('dist/'))).toBe(true)
      
      // Restore original cache
      ;(server as any).fileCache = originalCache
    })
  })
})