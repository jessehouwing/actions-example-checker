import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { findActionFiles } from '../src/action-finder.js'

describe('findActionFiles', () => {
  const testDir = '/tmp/action-finder-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should find action.yml in root', async () => {
    await fs.writeFile(path.join(testDir, 'action.yml'), 'name: Test')

    const files = await findActionFiles(testDir, 'action.{yml,yaml}')

    expect(files).toHaveLength(1)
    expect(files[0]).toContain('action.yml')
  })

  it('should find action.yaml in root', async () => {
    await fs.writeFile(path.join(testDir, 'action.yaml'), 'name: Test')

    const files = await findActionFiles(testDir, 'action.{yml,yaml}')

    expect(files).toHaveLength(1)
    expect(files[0]).toContain('action.yaml')
  })

  it('should find actions in subdirectories', async () => {
    const subDir1 = path.join(testDir, 'actions', 'action1')
    const subDir2 = path.join(testDir, 'actions', 'action2')
    await fs.mkdir(subDir1, { recursive: true })
    await fs.mkdir(subDir2, { recursive: true })

    await fs.writeFile(path.join(subDir1, 'action.yml'), 'name: Action1')
    await fs.writeFile(path.join(subDir2, 'action.yml'), 'name: Action2')

    const files = await findActionFiles(testDir, 'action.{yml,yaml}')

    expect(files.length).toBeGreaterThanOrEqual(2)
  })

  it('should filter out node_modules', async () => {
    const nodeModules = path.join(testDir, 'node_modules', 'some-package')
    await fs.mkdir(nodeModules, { recursive: true })
    await fs.writeFile(path.join(nodeModules, 'action.yml'), 'name: Test')

    const files = await findActionFiles(testDir, 'action.{yml,yaml}')

    expect(files).toHaveLength(0)
  })

  it('should filter out dist directory', async () => {
    const dist = path.join(testDir, 'dist')
    await fs.mkdir(dist, { recursive: true })
    await fs.writeFile(path.join(dist, 'action.yml'), 'name: Test')

    const files = await findActionFiles(testDir, 'action.{yml,yaml}')

    expect(files).toHaveLength(0)
  })

  it('should filter out .git directory', async () => {
    const git = path.join(testDir, '.git', 'hooks')
    await fs.mkdir(git, { recursive: true })
    await fs.writeFile(path.join(git, 'action.yml'), 'name: Test')

    const files = await findActionFiles(testDir, 'action.{yml,yaml}')

    expect(files).toHaveLength(0)
  })

  it('should return empty array when no actions found', async () => {
    const files = await findActionFiles(testDir, 'action.{yml,yaml}')

    expect(files).toHaveLength(0)
  })

  it('should find both yml and yaml extensions', async () => {
    await fs.writeFile(path.join(testDir, 'action.yml'), 'name: Test1')
    const subDir = path.join(testDir, 'sub')
    await fs.mkdir(subDir)
    await fs.writeFile(path.join(subDir, 'action.yaml'), 'name: Test2')

    const files = await findActionFiles(testDir, 'action.{yml,yaml}')

    expect(files.length).toBeGreaterThanOrEqual(2)
  })

  it('should deduplicate files', async () => {
    await fs.writeFile(path.join(testDir, 'action.yml'), 'name: Test')

    // Call twice to ensure deduplication works
    const files = await findActionFiles(testDir, 'action.{yml,yaml}')

    expect(files).toHaveLength(1)
  })
})
