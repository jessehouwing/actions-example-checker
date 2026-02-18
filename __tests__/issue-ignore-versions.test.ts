import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { loadActionSchema } from '../src/action-schema.js'
import { validateStep, findReferencedSteps } from '../src/validator.js'
import type { ActionSchema } from '../src/index.js'

describe('Issue: ignore-versions pattern validation', () => {
  const testDir = '/tmp/issue-ignore-versions-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should accept v1,v1.0,latest without error', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    // This replicates the jessehouwing/actions-semver-checker@v1 schema
    await fs.writeFile(
      actionPath,
      `
name: Semver Checker
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

    const schema = await loadActionSchema(
      actionPath,
      testDir,
      'jessehouwing/actions-semver-checker'
    )

    // This is the exact YAML from the issue that was failing
    const yaml = `
- uses: jessehouwing/actions-semver-checker@v1
  with:
    ignore-versions: 'v1,v1.0,latest'
`
    const schemas = new Map<string, ActionSchema>()
    schemas.set('jessehouwing/actions-semver-checker', schema)

    const steps = findReferencedSteps(yaml, schemas)
    expect(steps).toHaveLength(1)

    const errors = validateStep(steps[0], schema, 1)
    expect(errors).toHaveLength(0)
  })

  it('should accept v1.0.0,v2.0.0 without error', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    // This replicates the jessehouwing/actions-semver-checker@v2 schema
    await fs.writeFile(
      actionPath,
      `
name: Semver Checker
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

    const schema = await loadActionSchema(
      actionPath,
      testDir,
      'jessehouwing/actions-semver-checker'
    )

    // This is the exact YAML from the issue that was failing
    const yaml = `
- uses: jessehouwing/actions-semver-checker@v2
  with:
    ignore-versions: 'v1.0.0,v2.0.0'
`
    const schemas = new Map<string, ActionSchema>()
    schemas.set('jessehouwing/actions-semver-checker', schema)

    const steps = findReferencedSteps(yaml, schemas)
    expect(steps).toHaveLength(1)

    const errors = validateStep(steps[0], schema, 1)
    expect(errors).toHaveLength(0)
  })

  it('should report error for invalid version patterns', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(
      actionPath,
      `
name: Semver Checker
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

    const schema = await loadActionSchema(
      actionPath,
      testDir,
      'jessehouwing/actions-semver-checker'
    )

    // This should fail because 'invalid' doesn't match the pattern
    const yaml = `
- uses: jessehouwing/actions-semver-checker@v1
  with:
    ignore-versions: 'v1.0.0,invalid,v2.0.0'
`
    const schemas = new Map<string, ActionSchema>()
    schemas.set('jessehouwing/actions-semver-checker', schema)

    const steps = findReferencedSteps(yaml, schemas)
    expect(steps).toHaveLength(1)

    const errors = validateStep(steps[0], schema, 1)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toContain('invalid')
    expect(errors[0].message).toContain('does not match required pattern')
  })

  it('should support all version patterns from the schema', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(
      actionPath,
      `
name: Semver Checker
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

    const schema = await loadActionSchema(
      actionPath,
      testDir,
      'jessehouwing/actions-semver-checker'
    )

    // Test all valid patterns
    const validPatterns = [
      'v1',
      'v1.0',
      'v1.0.0',
      '1',
      '1.0',
      '1.0.0',
      'v1.*',
      'v1.0.*',
      '1.*',
      '1.0.*',
      'latest',
    ]

    for (const pattern of validPatterns) {
      const yaml = `
- uses: jessehouwing/actions-semver-checker@v1
  with:
    ignore-versions: '${pattern}'
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('jessehouwing/actions-semver-checker', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    }
  })
})
