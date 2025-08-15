import { FileDiscovery } from './file-discovery'
import fs from 'fs/promises'
import path from 'path'

describe('FileDiscovery', () => {
  let tempDir: string
  let fileDiscovery: FileDiscovery

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-'))
    fileDiscovery = new FileDiscovery()
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true })
  })

  describe('scanFiles', () => {
    it('should discover files recursively', async () => {
      // Create test file structure
      await fs.mkdir(path.join(tempDir, 'src'), { recursive: true })
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}')
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export {}')
      await fs.writeFile(path.join(tempDir, 'src', 'utils.ts'), 'export {}')

      const files = await fileDiscovery.scanFiles(tempDir)

      expect(files).toHaveLength(3)
      expect(files.map((f) => f.relativePath).sort()).toEqual([
        'package.json',
        'src/index.ts',
        'src/utils.ts',
      ])
    })

    it('should respect .gitignore patterns', async () => {
      // Create test files
      await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true })
      await fs.mkdir(path.join(tempDir, 'dist'), { recursive: true })
      await fs.writeFile(path.join(tempDir, '.gitignore'), 'node_modules/\ndist/\n*.log')
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}')
      await fs.writeFile(path.join(tempDir, 'debug.log'), 'logs')
      await fs.writeFile(path.join(tempDir, 'node_modules', 'module.js'), 'module')
      await fs.writeFile(path.join(tempDir, 'dist', 'main.js'), 'compiled')

      const files = await fileDiscovery.scanFiles(tempDir)

      expect(files).toHaveLength(2)
      const filePaths = files.map((f) => f.relativePath).sort()
      expect(filePaths).toEqual(['.gitignore', 'package.json'])
    })

    it('should complete scan within 100ms for small projects', async () => {
      // Create 50 files in various directories
      for (let i = 0; i < 50; i++) {
        const dir = Math.floor(i / 10)
        await fs.mkdir(path.join(tempDir, `dir${dir}`), { recursive: true })
        await fs.writeFile(path.join(tempDir, `dir${dir}`, `file${i}.ts`), 'export {}')
      }

      const startTime = Date.now()
      const files = await fileDiscovery.scanFiles(tempDir)
      const scanTime = Date.now() - startTime

      expect(scanTime).toBeLessThan(100)
      expect(files).toHaveLength(50)
    })

    it('should handle non-existent directories gracefully', async () => {
      const files = await fileDiscovery.scanFiles('/non-existent-directory')
      expect(files).toEqual([])
    })
  })

  describe('FileInfo structure', () => {
    it('should provide complete file information', async () => {
      await fs.writeFile(path.join(tempDir, 'test.ts'), 'console.log("test");')

      const files = await fileDiscovery.scanFiles(tempDir)
      const file = files[0]

      expect(file).toHaveProperty('absolutePath')
      expect(file).toHaveProperty('relativePath', 'test.ts')
      expect(file).toHaveProperty('name', 'test.ts')
      expect(file).toHaveProperty('extension', '.ts')
      expect(file).toHaveProperty('directory', '.')
      expect(file).toHaveProperty('size')
      expect(file).toHaveProperty('lastModified')
      expect(typeof file.size).toBe('number')
      expect(file.lastModified instanceof Date).toBe(true)
    })
  })
})
