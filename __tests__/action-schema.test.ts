import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { loadActionSchema } from '../src/action-schema.js'

describe('loadActionSchema', () => {
  const testDir = '/tmp/action-schema-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should load basic action schema', async () => {
    const actionYml = `
name: Test Action
description: A test action
inputs:
  input1:
    description: First input
    required: true
  input2:
    description: Second input
    required: false
outputs:
  output1:
    description: First output
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

    expect(schema.actionReference).toBe('owner/repo')
    expect(schema.inputs.size).toBe(2)
    expect(schema.inputs.get('input1')?.required).toBe(true)
    expect(schema.inputs.get('input2')?.required).toBe(false)
    expect(schema.outputs.size).toBe(1)
    expect(schema.outputs.has('output1')).toBe(true)
  })

  // Type inference removed - action.yaml schema doesn't support datatyping
  it.skip('should detect boolean type from description', async () => {
    // Test skipped - type inference removed
  })

  // Type inference removed - action.yaml schema doesn't support datatyping
  it.skip('should detect number type from description', async () => {
    // Test skipped - type inference removed
  })

  // Options extraction removed - action.yaml schema doesn't support datatyping
  it.skip('should extract options from description', async () => {
    // Test skipped - options extraction removed
  })

  // Options extraction removed - action.yaml schema doesn't support datatyping
  it.skip('should extract options with different keywords', async () => {
    // Test skipped - options extraction removed
  })

  // Options extraction removed - action.yaml schema doesn't support datatyping
  it.skip('should extract options and stop at default keyword', async () => {
    // Test skipped - options extraction removed
  })

  // Options and type extraction removed - action.yaml schema doesn't support datatyping
  it.skip('should extract boolean options correctly', async () => {
    // Test skipped - options and type extraction removed
  })

  // Options extraction removed - action.yaml schema doesn't support datatyping
  it.skip('should extract options with square brackets', async () => {
    // Test skipped - options extraction removed
  })

  it('should handle subdirectory actions', async () => {
    const subDir = path.join(testDir, 'sub', 'action')
    await fs.mkdir(subDir, { recursive: true })

    const actionYml = `
name: Sub Action
inputs:
  test:
    description: Test input
`
    const actionPath = path.join(subDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

    expect(schema.actionReference).toBe('owner/repo/sub/action')
  })

  it('should handle action with no inputs or outputs', async () => {
    const actionYml = `
name: Simple Action
description: No inputs or outputs
runs:
  using: node24
  main: index.js
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

    expect(schema.inputs.size).toBe(0)
    expect(schema.outputs.size).toBe(0)
  })

  // Type extraction removed - action.yaml schema doesn't support datatyping
  it.skip('should handle explicit type field', async () => {
    // Test skipped - type extraction removed
  })

  it('should throw error for invalid YAML', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, 'invalid: yaml: content:')

    await expect(
      loadActionSchema(actionPath, testDir, 'owner/repo')
    ).rejects.toThrow()
  })

  it('should throw error for non-object YAML', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, 'just a string')

    await expect(
      loadActionSchema(actionPath, testDir, 'owner/repo')
    ).rejects.toThrow('Invalid action.yml format')
  })
})
