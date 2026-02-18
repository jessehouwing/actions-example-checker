import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { loadActionSchema } from '../src/action-schema.js'
import { validateStep, findReferencedSteps } from '../src/validator.js'
import type { ActionSchema } from '../src/index.js'

describe('Separators with match pattern (shorthand)', () => {
  const testDir = '/tmp/separators-match-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should validate comma-separated values with match pattern (no explicit items)', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(
      actionPath,
      `
name: Test Action
inputs:
  ignore-versions:
    description: 'Versions to ignore'
    required: false
`
    )

    await fs.writeFile(
      schemaPath,
      `
inputs:
  ignore-versions:
    type: string
    separators: ['newline', ',']
    match: '^(v?\\d+(\\.\\d+)?(\\.\\d+)?|v?\\d+\\.\\*|v?\\d+\\.\\d+\\.\\*|latest)$'
`
    )

    const schema = await loadActionSchema(actionPath, testDir, 'owner/test-action')

    // Check that items was auto-created
    const ignoreVersions = schema.inputs.get('ignore-versions')
    expect(ignoreVersions).toBeDefined()
    expect(ignoreVersions?.separators).toEqual(['newline', ','])
    expect(ignoreVersions?.items).toBeDefined()
    expect(ignoreVersions?.items?.match).toBeDefined()

    // Test valid comma-separated values
    const yaml1 = `
- uses: owner/test-action@v1
  with:
    ignore-versions: 'v1,v1.0,latest'
`
    const schemas = new Map<string, ActionSchema>()
    schemas.set('owner/test-action', schema)

    const steps1 = findReferencedSteps(yaml1, schemas)
    expect(steps1).toHaveLength(1)

    const errors1 = validateStep(steps1[0], schema, 1)
    expect(errors1).toHaveLength(0)

    // Test another valid case
    const yaml2 = `
- uses: owner/test-action@v2
  with:
    ignore-versions: 'v1.0.0,v2.0.0'
`
    const steps2 = findReferencedSteps(yaml2, schemas)
    expect(steps2).toHaveLength(1)

    const errors2 = validateStep(steps2[0], schema, 1)
    expect(errors2).toHaveLength(0)
  })

  it('should report errors for invalid values in comma-separated list', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(
      actionPath,
      `
name: Test Action
inputs:
  ignore-versions:
    description: 'Versions to ignore'
    required: false
`
    )

    await fs.writeFile(
      schemaPath,
      `
inputs:
  ignore-versions:
    type: string
    separators: ','
    match: '^v?\\d+(\\.\\d+)?(\\.\\d+)?$'
`
    )

    const schema = await loadActionSchema(actionPath, testDir, 'owner/test-action')

    // Test with an invalid version in the list
    const yaml = `
- uses: owner/test-action@v1
  with:
    ignore-versions: 'v1.0.0,invalid-version,v2.0.0'
`
    const schemas = new Map<string, ActionSchema>()
    schemas.set('owner/test-action', schema)

    const steps = findReferencedSteps(yaml, schemas)
    expect(steps).toHaveLength(1)

    const errors = validateStep(steps[0], schema, 1)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toContain('invalid-version')
    expect(errors[0].message).toContain('does not match required pattern')
  })

  it('should work with type reference and added separators', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(
      actionPath,
      `
name: Test Action
inputs:
  ignore-versions:
    description: 'Versions to ignore'
    required: false
`
    )

    await fs.writeFile(
      schemaPath,
      `
types:
  version:
    type: string
    match: '^v?\\d+(\\.\\d+)?(\\.\\d+)?$'

inputs:
  ignore-versions:
    type: version
    separators: ['newline', ',']
`
    )

    const schema = await loadActionSchema(actionPath, testDir, 'owner/test-action')

    // Check that items was auto-created from the version type
    const ignoreVersions = schema.inputs.get('ignore-versions')
    expect(ignoreVersions).toBeDefined()
    expect(ignoreVersions?.separators).toEqual(['newline', ','])
    expect(ignoreVersions?.items).toBeDefined()
    expect(ignoreVersions?.items?.match).toBeDefined()

    // Test valid comma-separated values
    const yaml = `
- uses: owner/test-action@v1
  with:
    ignore-versions: 'v1,v1.0,v2.0.0'
`
    const schemas = new Map<string, ActionSchema>()
    schemas.set('owner/test-action', schema)

    const steps = findReferencedSteps(yaml, schemas)
    expect(steps).toHaveLength(1)

    const errors = validateStep(steps[0], schema, 1)
    expect(errors).toHaveLength(0)
  })

  it('should work with choice options and separators', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(
      actionPath,
      `
name: Test Action
inputs:
  environments:
    description: 'Target environments'
    required: false
`
    )

    await fs.writeFile(
      schemaPath,
      `
inputs:
  environments:
    type: choice
    options:
      - dev
      - staging
      - prod
    separators: ','
`
    )

    const schema = await loadActionSchema(actionPath, testDir, 'owner/test-action')

    // Check that items was auto-created with options
    const environments = schema.inputs.get('environments')
    expect(environments).toBeDefined()
    expect(environments?.separators).toEqual([','])
    expect(environments?.items).toBeDefined()
    expect(environments?.items?.options).toEqual(['dev', 'staging', 'prod'])

    // Test valid comma-separated values
    const yaml = `
- uses: owner/test-action@v1
  with:
    environments: 'dev,staging,prod'
`
    const schemas = new Map<string, ActionSchema>()
    schemas.set('owner/test-action', schema)

    const steps = findReferencedSteps(yaml, schemas)
    expect(steps).toHaveLength(1)

    const errors = validateStep(steps[0], schema, 1)
    expect(errors).toHaveLength(0)
  })

  it('should not auto-create items when items is explicitly defined', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(
      actionPath,
      `
name: Test Action
inputs:
  tags:
    description: 'Tags'
    required: false
`
    )

    await fs.writeFile(
      schemaPath,
      `
inputs:
  tags:
    type: string
    match: '^[a-z]+$'
    separators: ','
    items:
      type: string
      match: '^[a-z0-9-]+$'
`
    )

    const schema = await loadActionSchema(actionPath, testDir, 'owner/test-action')

    // Check that explicit items takes precedence
    const tags = schema.inputs.get('tags')
    expect(tags).toBeDefined()
    expect(tags?.match).toBeDefined()
    expect(tags?.match?.test('abc')).toBe(true)
    expect(tags?.items).toBeDefined()
    expect(tags?.items?.match).toBeDefined()
    // The items match is different from the parent match
    expect(tags?.items?.match?.test('abc-123')).toBe(true)
    expect(tags?.match?.test('abc-123')).toBe(false)
  })
})
