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

  it('should load type from explicit type field in action.yml', async () => {
    const actionYml = `
name: Test Action
inputs:
  debug:
    description: Enable debug mode
    type: boolean
    required: false
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

    expect(schema.inputs.get('debug')?.type).toBe('boolean')
  })

  it('should not detect type from description', async () => {
    const actionYml = `
name: Test Action
inputs:
  timeout:
    description: Timeout in seconds (number)
    required: false
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

    // Type should not be detected from description
    expect(schema.inputs.get('timeout')?.type).toBeUndefined()
  })

  it('should load type from schema file', async () => {
    const actionYml = `
name: Test Action
inputs:
  environment:
    description: Deployment environment
    required: true
`
    const schemaYml = `
inputs:
  environment:
    type: choice
    options:
      - development
      - staging
      - production
`
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')
    await fs.writeFile(actionPath, actionYml)
    await fs.writeFile(schemaPath, schemaYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

    expect(schema.inputs.get('environment')?.type).toBe('choice')
    const options = schema.inputs.get('environment')?.options
    expect(options).toBeDefined()
    expect(options).toContain('development')
    expect(options).toContain('staging')
    expect(options).toContain('production')
  })

  it('should load schema with string type and match pattern', async () => {
    const actionYml = `
name: Test Action
inputs:
  level:
    description: Log level
    required: false
`
    const schemaYml = `
inputs:
  level:
    type: string
    match: "^(debug|info|warn|error)$"
`
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')
    await fs.writeFile(actionPath, actionYml)
    await fs.writeFile(schemaPath, schemaYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

    expect(schema.inputs.get('level')?.type).toBe('string')
    expect(schema.inputs.get('level')?.match).toBeDefined()
  })

  it('should load schema with custom types', async () => {
    const actionYml = `
name: Test Action
inputs:
  url:
    description: URL input
    required: false
`
    const schemaYml = `
types:
  url:
    type: string
    match: "^https?://.*"
inputs:
  url: url
`
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')
    await fs.writeFile(actionPath, actionYml)
    await fs.writeFile(schemaPath, schemaYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

    expect(schema.inputs.get('url')?.type).toBe('string')
    expect(schema.inputs.get('url')?.match).toBeDefined()
  })

  it('should prefer schema file over explicit type in action.yml', async () => {
    const actionYml = `
name: Test Action
inputs:
  enabled:
    description: Feature flag
    type: string
`
    const schemaYml = `
inputs:
  enabled:
    type: boolean
`
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')
    await fs.writeFile(actionPath, actionYml)
    await fs.writeFile(schemaPath, schemaYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

    // Schema file should override action.yml type
    expect(schema.inputs.get('enabled')?.type).toBe('boolean')
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

  it('should handle explicit type field', async () => {
    const actionYml = `
name: Test Action
inputs:
  debug:
    description: Debug mode
    type: boolean
  count:
    description: Count value
    type: number
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

    expect(schema.inputs.get('debug')?.type).toBe('boolean')
    expect(schema.inputs.get('count')?.type).toBe('number')
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
