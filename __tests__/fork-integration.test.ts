import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { loadActionSchema } from '../src/action-schema.js'
import {
  extractYamlCodeBlocks,
  findReferencedSteps,
  validateStep,
} from '../src/validator.js'

describe('Fork Support Integration', () => {
  const testDir = '/tmp/fork-integration-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should validate examples using fork name', async () => {
    const actionYml = `
name: Test Action
inputs:
  environment:
    description: 'Options: dev, prod'
    required: true
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(
      actionPath,
      testDir,
      'jessehouwing/azdo-marketplace',
      'microsoft/azure-devops-extension-tasks'
    )

    expect(schema.actionReference).toBe('jessehouwing/azdo-marketplace')
    expect(schema.alternativeNames).toContain(
      'microsoft/azure-devops-extension-tasks'
    )

    // Test with fork name
    const markdown = `
\`\`\`yaml
- uses: jessehouwing/azdo-marketplace@v1
  with:
    environment: dev
\`\`\`
`
    const schemas = new Map([
      ['jessehouwing/azdo-marketplace', schema],
      ['microsoft/azure-devops-extension-tasks', schema],
    ])
    const blocks = extractYamlCodeBlocks(markdown)
    const steps = findReferencedSteps(blocks[0].text, schemas)
    const errors = validateStep(steps[0], schema, 1)

    expect(errors).toHaveLength(0)
  })

  it('should validate examples using parent name', async () => {
    const actionYml = `
name: Test Action
inputs:
  environment:
    description: 'Options: dev, prod'
    required: true
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(
      actionPath,
      testDir,
      'jessehouwing/azdo-marketplace',
      'microsoft/azure-devops-extension-tasks'
    )

    // Test with parent name
    const markdown = `
\`\`\`yaml
- uses: microsoft/azure-devops-extension-tasks@v1
  with:
    environment: dev
\`\`\`
`
    const schemas = new Map([
      ['jessehouwing/azdo-marketplace', schema],
      ['microsoft/azure-devops-extension-tasks', schema],
    ])
    const blocks = extractYamlCodeBlocks(markdown)
    const steps = findReferencedSteps(blocks[0].text, schemas)

    expect(steps).toHaveLength(1)
    expect(steps[0].actionReference).toBe(
      'microsoft/azure-devops-extension-tasks'
    )

    const errors = validateStep(steps[0], schema, 1)
    expect(errors).toHaveLength(0)
  })

  it('should validate examples with both fork and parent in same block', async () => {
    const actionYml = `
name: Test Action
inputs:
  environment:
    description: 'Options: dev, prod'
outputs:
  result:
    description: Result output
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(
      actionPath,
      testDir,
      'jessehouwing/azdo-marketplace',
      'microsoft/azure-devops-extension-tasks'
    )

    const markdown = `
\`\`\`yaml
- uses: jessehouwing/azdo-marketplace@v1
  id: fork-action
  with:
    environment: dev
- uses: microsoft/azure-devops-extension-tasks@v1
  id: parent-action
  with:
    environment: prod
- run: echo \${{ steps.fork-action.outputs.result }} \${{ steps.parent-action.outputs.result }}
\`\`\`
`
    const schemas = new Map([
      ['jessehouwing/azdo-marketplace', schema],
      ['microsoft/azure-devops-extension-tasks', schema],
    ])
    const blocks = extractYamlCodeBlocks(markdown)
    const steps = findReferencedSteps(blocks[0].text, schemas)

    expect(steps).toHaveLength(2)

    // Both should validate without errors
    const errors1 = validateStep(steps[0], schema, 1)
    const errors2 = validateStep(steps[1], schema, 1)

    expect(errors1).toHaveLength(0)
    expect(errors2).toHaveLength(0)
  })

  it('should detect errors in fork examples', async () => {
    const actionYml = `
name: Test Action
inputs:
  environment:
    description: 'Options: dev, prod'
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(
      actionPath,
      testDir,
      'jessehouwing/azdo-marketplace',
      'microsoft/azure-devops-extension-tasks'
    )

    const markdown = `
\`\`\`yaml
- uses: microsoft/azure-devops-extension-tasks@v1
  with:
    invalid-input: value
\`\`\`
`
    const schemas = new Map([
      ['jessehouwing/azdo-marketplace', schema],
      ['microsoft/azure-devops-extension-tasks', schema],
    ])
    const blocks = extractYamlCodeBlocks(markdown)
    const steps = findReferencedSteps(blocks[0].text, schemas)
    const errors = validateStep(steps[0], schema, 1)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toContain('invalid-input')
  })

  it('should handle subdirectory actions with fork', async () => {
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

    const schema = await loadActionSchema(
      actionPath,
      testDir,
      'jessehouwing/repo',
      'microsoft/repo'
    )

    expect(schema.actionReference).toBe('jessehouwing/repo/sub/action')
    expect(schema.alternativeNames).toContain('microsoft/repo/sub/action')
  })
})
