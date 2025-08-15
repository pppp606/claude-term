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
    it('should complete single file match', () => {
      const [completions, originalLine] = (server as any).completeCommand('/send package')
      
      expect(completions).toHaveLength(1)
      expect(completions[0]).toBe('/send package.json')
      expect(originalLine).toBe('/send package')
    })

    it('should provide common prefix for multiple matches', () => {
      const [completions] = (server as any).completeCommand('/send User')
      
      // Should either return common prefix or all matches
      expect(completions.length).toBeGreaterThan(0)
      if (completions.length === 1) {
        // Common prefix completion
        expect(completions[0]).toContain('/send ')
        expect(completions[0]).toContain('User')
      } else {
        // All matches
        expect(completions).toContain('/send src/components/UserProfile.tsx')
        expect(completions).toContain('/send src/components/UserList.tsx')
      }
    })

    it('should return multiple completions when no common prefix', () => {
      const [completions] = (server as any).completeCommand('/cat ')
      
      expect(completions.length).toBeGreaterThan(1)
      expect(completions[0]).toContain('/cat ')
    })

    it('should handle non-file commands', () => {
      const [completions] = (server as any).completeCommand('/he')
      
      expect(completions).toContain('/help')
    })

    it('should return empty for no matches', () => {
      const [completions] = (server as any).completeCommand('/send nonexistent')
      
      expect(completions).toEqual([])
    })

    it('should handle /cat command', () => {
      const [completions] = (server as any).completeCommand('/cat user')
      
      expect(completions.length).toBeGreaterThan(0)
      expect(completions.some((c: string) => c.includes('userHelper.ts'))).toBe(true)
    })
  })

  describe('getFileCompletionsSync', () => {
    it('should return fuzzy search results', () => {
      const completions = (server as any).getFileCompletionsSync('user')
      
      expect(completions.length).toBeGreaterThan(0)
      expect(completions).toContain('src/utils/userHelper.ts')
    })

    it('should return exact matches with high priority', () => {
      const completions = (server as any).getFileCompletionsSync('package.json')
      
      expect(completions[0]).toBe('package.json')
    })

    it('should handle empty prefix', () => {
      const completions = (server as any).getFileCompletionsSync('')
      
      expect(completions.length).toBeGreaterThan(0)
      expect(completions.length).toBeLessThanOrEqual(10)
    })

    it('should handle partial file names', () => {
      const completions = (server as any).getFileCompletionsSync('User')
      
      expect(completions.length).toBeGreaterThan(0)
      expect(completions.some((c: string) => c.includes('UserProfile.tsx'))).toBe(true)
      expect(completions.some((c: string) => c.includes('UserList.tsx'))).toBe(true)
    })
  })
})