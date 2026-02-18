import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { loadActionSchema } from '../src/action-schema.js'
import {
  extractYamlCodeBlocks,
  findReferencedSteps,
  validateStep,
} from '../src/validator.js'

describe('Action Description Examples', () => {
  const testDir = '/tmp/description-examples-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should extract examples from root description', async () => {
    const actionYml = `
name: Test Action
description: |-
  Test action with example:
  
  \`\`\`yaml
  - uses: owner/test-action@v1
    with:
      input1: value1
  \`\`\`
inputs:
  input1:
    description: Input 1
    required: true
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(
      actionPath,
      testDir,
      'owner/test-action'
    )

    expect(schema.descriptions).toHaveLength(2) // root + input1
    expect(schema.descriptions[0]).toContain('Test action with example')
  })

  it('should extract examples from input descriptions', async () => {
    const actionYml = `
name: Test Action
inputs:
  auth-type:
    description: |-
      Authentication type
      
      Example:
      \`\`\`yaml
      - uses: owner/test-action@v1
        with:
          auth-type: oidc
      \`\`\`
    required: false
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(
      actionPath,
      testDir,
      'owner/test-action'
    )

    expect(schema.descriptions).toHaveLength(1)
    expect(schema.descriptions[0]).toContain('Authentication type')
    expect(schema.descriptions[0]).toContain('auth-type: oidc')
  })

  it('should validate examples in descriptions', async () => {
    const actionYml = `
name: Test Action
description: |-
  Example with invalid input:
  \`\`\`yaml
  - uses: owner/test-action@v1
    with:
      invalid-input: value
  \`\`\`
inputs:
  valid-input:
    description: Valid input
    required: true
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(
      actionPath,
      testDir,
      'owner/test-action'
    )
    const schemas = new Map([['owner/test-action', schema]])

    // Extract blocks from descriptions
    const blocks = extractYamlCodeBlocks(schema.descriptions.join('\n'))
    expect(blocks).toHaveLength(1)

    const steps = findReferencedSteps(blocks[0].text, schemas)
    expect(steps).toHaveLength(1)

    const errors = validateStep(steps[0], schema, 1)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toContain('invalid-input')
  })

  it('should accept valid examples in descriptions', async () => {
    const actionYml = `
name: Test Action
inputs:
  operation:
    description: |-
      Operation to perform
      
      Example:
      \`\`\`yaml
      - uses: owner/test-action@v1
        with:
          operation: publish
          token: \${{ secrets.TOKEN }}
      \`\`\`
    required: true
  token:
    description: Access token
    required: true
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(
      actionPath,
      testDir,
      'owner/test-action'
    )
    const schemas = new Map([['owner/test-action', schema]])

    const blocks = extractYamlCodeBlocks(schema.descriptions.join('\n'))
    const steps = findReferencedSteps(blocks[0].text, schemas)
    const errors = validateStep(steps[0], schema, 1)

    expect(errors).toHaveLength(0)
  })

  it('should handle multiple examples in one description', async () => {
    const actionYml = `
name: Test Action
inputs:
  mode:
    description: |-
      Mode selection
      
      Example 1:
      \`\`\`yaml
      - uses: owner/test-action@v1
        with:
          mode: standard
      \`\`\`
      
      Example 2:
      \`\`\`yaml
      - uses: owner/test-action@v1
        with:
          mode: advanced
      \`\`\`
    required: true
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(
      actionPath,
      testDir,
      'owner/test-action'
    )
    const schemas = new Map([['owner/test-action', schema]])

    const blocks = extractYamlCodeBlocks(schema.descriptions[0])
    expect(blocks).toHaveLength(2)

    for (const block of blocks) {
      const steps = findReferencedSteps(block.text, schemas)
      expect(steps).toHaveLength(1)
    }
  })

  it('should validate with reference to other actions in descriptions', async () => {
    const actionYml = `
name: Test Action
inputs:
  auth:
    description: |-
      Authentication setup
      
      Run azure/login before this action:
      \`\`\`yaml
      - uses: azure/login@v2
        with:
          client-id: abc
          tenant-id: def
      - uses: owner/test-action@v1
        with:
          auth: oidc
      \`\`\`
    required: true
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(
      actionPath,
      testDir,
      'owner/test-action'
    )
    const schemas = new Map([['owner/test-action', schema]])

    const blocks = extractYamlCodeBlocks(schema.descriptions[0])
    const steps = findReferencedSteps(blocks[0].text, schemas)

    // Should find the owner/test-action step but not azure/login
    expect(steps).toHaveLength(1)
    expect(steps[0].actionReference).toBe('owner/test-action')
  })
})
