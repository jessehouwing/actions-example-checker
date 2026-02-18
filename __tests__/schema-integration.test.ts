import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { loadActionSchema } from '../src/action-schema.js'
import { findReferencedSteps, validateStep } from '../src/validator.js'

describe('Schema Integration Tests', () => {
  const testDir = '/tmp/schema-integration-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should validate complete workflow with schema file', async () => {
    // Create action.yml
    const actionYml = `
name: Deploy Action
description: Deploy application to various environments
inputs:
  environment:
    description: Target environment
    required: true
  version:
    description: Version to deploy
    required: true
  dry-run:
    description: Perform a dry run without actual deployment
    required: false
    default: 'false'
  log-level:
    description: Logging level
    required: false
    default: 'info'
outputs:
  deployment-id:
    description: The deployment ID
  deployment-url:
    description: The deployment URL
`

    // Create action.schema.yml with advanced validation
    const schemaYml = `
types:
  url:
    type: string
    match: "^https?://.*"
  semver:
    type: string
    match: "^\\\\d+\\\\.\\\\d+\\\\.\\\\d+$"

inputs:
  environment:
    type: choice
    options:
      - development
      - staging
      - production
  version: semver
  dry-run:
    type: boolean
  log-level:
    type: choice
    options:
      - debug
      - info
      - warning
      - error

outputs:
  deployment-id:
    type: string
  deployment-url: url
`

    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')
    await fs.writeFile(actionPath, actionYml)
    await fs.writeFile(schemaPath, schemaYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')
    const schemas = new Map([['owner/repo', schema]])

    // Test valid workflow
    const validYaml = `
- uses: owner/repo@v1
  with:
    environment: production
    version: 1.2.3
    dry-run: false
    log-level: info
`
    const validSteps = findReferencedSteps(validYaml, schemas)
    expect(validSteps).toHaveLength(1)
    const validErrors = validateStep(validSteps[0], schema, 1)
    expect(validErrors).toHaveLength(0)

    // Test invalid environment
    const invalidEnvYaml = `
- uses: owner/repo@v1
  with:
    environment: testing
    version: 1.2.3
`
    const invalidEnvSteps = findReferencedSteps(invalidEnvYaml, schemas)
    const invalidEnvErrors = validateStep(invalidEnvSteps[0], schema, 1)
    expect(invalidEnvErrors.length).toBeGreaterThan(0)
    expect(invalidEnvErrors[0].message).toContain('development, staging, production')

    // Test invalid version format
    const invalidVersionYaml = `
- uses: owner/repo@v1
  with:
    environment: production
    version: v1.2.3
`
    const invalidVersionSteps = findReferencedSteps(invalidVersionYaml, schemas)
    const invalidVersionErrors = validateStep(invalidVersionSteps[0], schema, 1)
    expect(invalidVersionErrors.length).toBeGreaterThan(0)
    expect(invalidVersionErrors[0].message).toContain('does not match required pattern')

    // Test valid version formats
    const versions = ['1.2.3', '0.0.1', '10.20.30']
    for (const version of versions) {
      const yaml = `
- uses: owner/repo@v1
  with:
    environment: production
    version: ${version}
`
      const steps = findReferencedSteps(yaml, schemas)
      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    }
  })

  it('should validate boolean with truthy/falsy values', async () => {
    const actionYml = `
name: Test Action
inputs:
  enabled:
    description: Enable feature
    required: false
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
    const schemas = new Map([['owner/repo', schema]])

    // Test truthy values
    const truthyValues = ['true', 'yes', 'y', '1', 'on', 'TRUE', 'YES']
    for (const value of truthyValues) {
      const yaml = `
- uses: owner/repo@v1
  with:
    enabled: ${value}
`
      const steps = findReferencedSteps(yaml, schemas)
      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    }

    // Test falsy values
    const falsyValues = ['false', 'no', 'n', '0', 'off', 'FALSE', 'NO']
    for (const value of falsyValues) {
      const yaml = `
- uses: owner/repo@v1
  with:
    enabled: ${value}
`
      const steps = findReferencedSteps(yaml, schemas)
      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    }

    // Test invalid boolean
    const invalidYaml = `
- uses: owner/repo@v1
  with:
    enabled: maybe
`
    const invalidSteps = findReferencedSteps(invalidYaml, schemas)
    const invalidErrors = validateStep(invalidSteps[0], schema, 1)
    expect(invalidErrors.length).toBeGreaterThan(0)
    expect(invalidErrors[0].message).toContain('boolean')
  })

  it('should handle expressions properly', async () => {
    const actionYml = `
name: Test Action
inputs:
  environment:
    description: Target environment
    required: true
  count:
    description: Count
    required: false
`
    const schemaYml = `
inputs:
  environment:
    type: choice
    options:
      - dev
      - prod
  count:
    type: number
`
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')
    await fs.writeFile(actionPath, actionYml)
    await fs.writeFile(schemaPath, schemaYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')
    const schemas = new Map([['owner/repo', schema]])

    // Test expressions - should skip validation
    const expressionYaml = `
- uses: owner/repo@v1
  with:
    environment: \${{ secrets.ENV }}
    count: \${{ github.run_number }}
`
    const expressionSteps = findReferencedSteps(expressionYaml, schemas)
    const expressionErrors = validateStep(expressionSteps[0], schema, 1)
    expect(expressionErrors).toHaveLength(0)

    // Test literal expressions - should validate
    const literalYaml = `
- uses: owner/repo@v1
  with:
    environment: \${{ 'dev' }}
    count: \${{ 42 }}
`
    const literalSteps = findReferencedSteps(literalYaml, schemas)
    const literalErrors = validateStep(literalSteps[0], schema, 1)
    expect(literalErrors).toHaveLength(0)
  })

  it('should validate with comments and quotes', async () => {
    const actionYml = `
name: Test Action
inputs:
  value:
    description: A value
    required: true
`
    const schemaYml = `
inputs:
  value:
    type: choice
    options:
      - option1
      - option2
`
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')
    await fs.writeFile(actionPath, actionYml)
    await fs.writeFile(schemaPath, schemaYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')
    const schemas = new Map([['owner/repo', schema]])

    // Test with trailing comment
    const commentYaml = `
- uses: owner/repo@v1
  with:
    value: option1 # this is a comment
`
    const commentSteps = findReferencedSteps(commentYaml, schemas)
    const commentErrors = validateStep(commentSteps[0], schema, 1)
    expect(commentErrors).toHaveLength(0)

    // Test with quotes
    const quotedYaml = `
- uses: owner/repo@v1
  with:
    value: "option2"
`
    const quotedSteps = findReferencedSteps(quotedYaml, schemas)
    const quotedErrors = validateStep(quotedSteps[0], schema, 1)
    expect(quotedErrors).toHaveLength(0)
  })

  it('should work without schema file (backward compatibility)', async () => {
    const actionYml = `
name: Test Action
inputs:
  value:
    description: A value
    type: string
    required: false
`
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, actionYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')
    expect(schema.inputs.get('value')?.type).toBe('string')
    // Without schema file, no match or options
    expect(schema.inputs.get('value')?.match).toBeUndefined()
    expect(schema.inputs.get('value')?.options).toBeUndefined()
  })

  it('should override action.yml type with schema file', async () => {
    const actionYml = `
name: Test Action
inputs:
  value:
    description: A value
    type: string
    required: false
`
    const schemaYml = `
inputs:
  value:
    type: number
`
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')
    await fs.writeFile(actionPath, actionYml)
    await fs.writeFile(schemaPath, schemaYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')
    // Schema file should override
    expect(schema.inputs.get('value')?.type).toBe('number')
  })
})
