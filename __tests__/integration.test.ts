import {
  describe,
  expect,
  it,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'

describe('Integration Tests', () => {
  const testDir = '/tmp/integration-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should find and parse action files', async () => {
    const actionYml = `
name: Test Action
inputs:
  environment:
    description: 'Deployment environment. Options: dev, prod'
    required: true
  debug:
    description: 'Enable debug (boolean)'
    required: false
outputs:
  result:
    description: Result
`
    await fs.writeFile(path.join(testDir, 'action.yml'), actionYml)

    const { findActionFiles } = await import('../src/action-finder.js')
    const files = await findActionFiles(testDir, 'action.{yml,yaml}')

    expect(files).toHaveLength(1)
  })

  // Type inference removed - action.yaml schema doesn't support datatyping
  it.skip('should load action schema correctly', async () => {
    // Test skipped - type inference removed
  })

  it('should extract and validate YAML blocks from markdown', async () => {
    const markdown = `
# Test Action

\`\`\`yaml
- uses: test/repo@v1
  with:
    environment: dev
\`\`\`
`
    const { extractYamlCodeBlocks } = await import('../src/validator.js')
    const blocks = extractYamlCodeBlocks(markdown)

    expect(blocks).toHaveLength(1)
    expect(blocks[0].text).toContain('test/repo@v1')
  })

  it('should validate complete workflow with errors', async () => {
    const actionYml = `
name: Test Action
inputs:
  environment:
    description: 'Options: dev, prod'
    required: true
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const markdown = `
\`\`\`yaml
- uses: test/repo@v1
  with:
    unknown: value
\`\`\`
`

    const { loadActionSchema } = await import('../src/action-schema.js')
    const { extractYamlCodeBlocks, findReferencedSteps, validateStep } =
      await import('../src/validator.js')

    const schema = await loadActionSchema(actionPath, testDir, 'test/repo')
    const schemas = new Map([['test/repo', schema]])
    const blocks = extractYamlCodeBlocks(markdown)
    const steps = findReferencedSteps(blocks[0].text, schemas)
    const errors = validateStep(steps[0], schema, 1)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toContain('unknown')
  })

  // Type validation removed - action.yaml schema doesn't support datatyping
  it.skip('should validate type constraints end-to-end', async () => {
    // Test skipped - type validation removed
  })

  it('should allow expressions in validation', async () => {
    const actionYml = `
name: Test Action
inputs:
  environment:
    description: 'Options: dev, prod'
    required: true
  debug:
    description: 'Boolean'
    type: boolean
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const markdown = `
\`\`\`yaml
- uses: test/repo@v1
  with:
    environment: \${{ inputs.env }}
    debug: \${{ github.event.inputs.debug }}
\`\`\`
`

    const { loadActionSchema } = await import('../src/action-schema.js')
    const { extractYamlCodeBlocks, findReferencedSteps, validateStep } =
      await import('../src/validator.js')

    const schema = await loadActionSchema(actionPath, testDir, 'test/repo')
    const schemas = new Map([['test/repo', schema]])
    const blocks = extractYamlCodeBlocks(markdown)
    const steps = findReferencedSteps(blocks[0].text, schemas)
    const errors = validateStep(steps[0], schema, 1)

    expect(errors).toHaveLength(0)
  })
})
