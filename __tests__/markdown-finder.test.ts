import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { findMarkdownFiles } from '../src/markdown-finder.js'

describe('findMarkdownFiles', () => {
  const testDir = '/tmp/markdown-finder-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should find README.md in root', async () => {
    await fs.writeFile(path.join(testDir, 'README.md'), '# Test')

    const files = await findMarkdownFiles(testDir, '**/*.md')

    expect(files).toHaveLength(1)
    expect(files[0]).toContain('README.md')
  })

  it('should find markdown files in subdirectories', async () => {
    const docsDir = path.join(testDir, 'docs')
    await fs.mkdir(docsDir)
    await fs.writeFile(path.join(testDir, 'README.md'), '# Root')
    await fs.writeFile(path.join(docsDir, 'guide.md'), '# Guide')

    const files = await findMarkdownFiles(testDir, '**/*.md')

    expect(files.length).toBeGreaterThanOrEqual(2)
  })

  it('should filter out node_modules', async () => {
    const nodeModules = path.join(testDir, 'node_modules', 'package')
    await fs.mkdir(nodeModules, { recursive: true })
    await fs.writeFile(path.join(nodeModules, 'README.md'), '# Test')

    const files = await findMarkdownFiles(testDir, '**/*.md')

    expect(files).toHaveLength(0)
  })

  it('should filter out dist directory', async () => {
    const dist = path.join(testDir, 'dist')
    await fs.mkdir(dist)
    await fs.writeFile(path.join(dist, 'README.md'), '# Test')

    const files = await findMarkdownFiles(testDir, '**/*.md')

    expect(files).toHaveLength(0)
  })

  it('should filter out .git directory', async () => {
    const git = path.join(testDir, '.git')
    await fs.mkdir(git)
    await fs.writeFile(path.join(git, 'README.md'), '# Test')

    const files = await findMarkdownFiles(testDir, '**/*.md')

    expect(files).toHaveLength(0)
  })

  it('should return empty array when no markdown files found', async () => {
    await fs.writeFile(path.join(testDir, 'test.txt'), 'Not markdown')

    const files = await findMarkdownFiles(testDir, '**/*.md')

    expect(files).toHaveLength(0)
  })

  it('should handle custom patterns', async () => {
    await fs.writeFile(path.join(testDir, 'README.md'), '# Test')
    await fs.writeFile(path.join(testDir, 'other.md'), '# Other')

    const files = await findMarkdownFiles(testDir, 'README.md')

    expect(files).toHaveLength(1)
    expect(files[0]).toContain('README.md')
  })

  it('should find markdown in nested subdirectories', async () => {
    const deep = path.join(testDir, 'a', 'b', 'c')
    await fs.mkdir(deep, { recursive: true })
    await fs.writeFile(path.join(deep, 'nested.md'), '# Nested')

    const files = await findMarkdownFiles(testDir, '**/*.md')

    expect(files).toHaveLength(1)
  })
})
