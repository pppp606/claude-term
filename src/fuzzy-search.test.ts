import { FuzzySearch } from './fuzzy-search'
import { FileInfo } from './file-discovery'

describe('FuzzySearch', () => {
  let fuzzySearch: FuzzySearch
  let sampleFiles: FileInfo[]

  beforeEach(() => {
    fuzzySearch = new FuzzySearch()
    sampleFiles = [
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
        absolutePath: '/project/src/utils/userHelper.ts',
        relativePath: 'src/utils/userHelper.ts',
        name: 'userHelper.ts',
        extension: '.ts',
        directory: 'src/utils',
        size: 512,
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
      {
        absolutePath: '/project/README.md',
        relativePath: 'README.md',
        name: 'README.md',
        extension: '.md',
        directory: '.',
        size: 1536,
        lastModified: new Date(),
      },
      {
        absolutePath: '/project/src/components/ProductList.tsx',
        relativePath: 'src/components/ProductList.tsx',
        name: 'ProductList.tsx',
        extension: '.tsx',
        directory: 'src/components',
        size: 2048,
        lastModified: new Date(),
      },
    ]
  })

  describe('search', () => {
    it('should find exact matches with highest score', () => {
      const results = fuzzySearch.search('package.json', sampleFiles)
      
      expect(results).toHaveLength(1)
      expect(results[0].file.name).toBe('package.json')
      expect(results[0].score).toBeGreaterThan(0.9)
    })

    it('should find fuzzy matches by filename', () => {
      const results = fuzzySearch.search('user', sampleFiles)
      
      expect(results.length).toBeGreaterThan(0)
      const userFiles = results.map(r => r.file.name)
      expect(userFiles).toContain('UserProfile.tsx')
      expect(userFiles).toContain('userHelper.ts')
    })

    it('should find matches by path components', () => {
      const results = fuzzySearch.search('comp', sampleFiles)
      
      expect(results.length).toBeGreaterThan(0)
      const componentFiles = results.filter(r => r.file.directory.includes('components'))
      expect(componentFiles.length).toBeGreaterThan(0)
    })

    it('should rank exact matches higher than fuzzy matches', () => {
      const results = fuzzySearch.search('README', sampleFiles)
      
      expect(results[0].file.name).toBe('README.md')
      expect(results[0].score).toBeGreaterThan(0.8)
    })

    it('should handle case-insensitive search', () => {
      const results = fuzzySearch.search('userprofile', sampleFiles)
      
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].file.name).toBe('UserProfile.tsx')
    })

    it('should limit results to specified count', () => {
      const results = fuzzySearch.search('', sampleFiles, 3)
      
      expect(results).toHaveLength(3)
    })

    it('should complete search within 50ms for typical datasets', () => {
      // Create larger dataset
      const largeDataset: FileInfo[] = []
      for (let i = 0; i < 1000; i++) {
        largeDataset.push({
          absolutePath: `/project/file${i}.ts`,
          relativePath: `file${i}.ts`,
          name: `file${i}.ts`,
          extension: '.ts',
          directory: '.',
          size: 100,
          lastModified: new Date(),
        })
      }

      const startTime = Date.now()
      const results = fuzzySearch.search('file5', largeDataset)
      const searchTime = Date.now() - startTime

      expect(searchTime).toBeLessThan(50)
      expect(results.length).toBeGreaterThan(0)
    })

    it('should return empty array for no matches', () => {
      const results = fuzzySearch.search('nonexistent', sampleFiles)
      
      expect(results).toEqual([])
    })

    it('should handle empty query gracefully', () => {
      const results = fuzzySearch.search('', sampleFiles)
      
      expect(results).toHaveLength(sampleFiles.length)
      // Should return all files, possibly sorted by some criteria
    })
  })

  describe('scoring algorithm', () => {
    it('should score based on match quality', () => {
      const exactMatch = fuzzySearch.search('package.json', sampleFiles)[0]
      const fuzzyMatch = fuzzySearch.search('pack', sampleFiles)[0]
      
      expect(exactMatch.score).toBeGreaterThan(fuzzyMatch.score)
    })

    it('should prefer filename matches over path matches', () => {
      const files = [
        {
          absolutePath: '/project/user/profile.ts',
          relativePath: 'user/profile.ts',
          name: 'profile.ts',
          extension: '.ts',
          directory: 'user',
          size: 100,
          lastModified: new Date(),
        },
        {
          absolutePath: '/project/src/userProfile.ts',
          relativePath: 'src/userProfile.ts',
          name: 'userProfile.ts',
          extension: '.ts',
          directory: 'src',
          size: 100,
          lastModified: new Date(),
        },
      ]

      const results = fuzzySearch.search('user', files)
      
      // Filename match should score higher than directory match
      expect(results[0].file.name).toBe('userProfile.ts')
    })
  })
})