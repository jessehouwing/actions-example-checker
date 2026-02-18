import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { loadActionSchema } from '../src/action-schema.js'
import { validateStep, findReferencedSteps } from '../src/validator.js'
import type { ActionSchema } from '../src/index.js'

describe('Multi-value input validation', () => {
  const testDir = '/tmp/multi-value-validation-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  async function createTestAction(
    actionYaml: string,
    schemaYaml: string
  ): Promise<ActionSchema> {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, actionYaml)
    await fs.writeFile(schemaPath, schemaYaml)

    return loadActionSchema(actionPath, testDir, 'owner/test-action')
  }

  describe('Comma-separated values', () => {
    it('should validate valid comma-separated tags', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  tags:
    description: 'Tags'
    required: false
`,
        `
inputs:
  tags:
    type: string
    separators: ','
    items:
      type: string
      match: "^[a-z0-9-]+$"
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    tags: tag1, tag-2, tag3
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    })

    it('should report errors for invalid comma-separated tags', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  tags:
    description: 'Tags'
    required: false
`,
        `
inputs:
  tags:
    type: string
    separators: ','
    items:
      type: string
      match: "^[a-z0-9-]+$"
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    tags: valid-tag, INVALID_TAG, another-valid
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toContain('INVALID_TAG')
      expect(errors[0].message).toContain('does not match required pattern')
    })
  })

  describe('Newline-separated values', () => {
    it('should validate valid newline-separated environments', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  environments:
    description: 'Environments'
    required: false
`,
        `
inputs:
  environments:
    type: string
    separators: newline
    items:
      type: choice
      options:
        - development
        - staging
        - production
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    environments: |
      development
      staging
      production
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    })

    it('should report errors for invalid newline-separated environments', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  environments:
    description: 'Environments'
    required: false
`,
        `
inputs:
  environments:
    type: string
    separators: newline
    items:
      type: choice
      options:
        - development
        - staging
        - production
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    environments: |
      development
      testing
      production
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toContain('testing')
      expect(errors[0].message).toContain('expects one of')
    })
  })

  describe('Multi-value with numbers', () => {
    it('should validate comma-separated numbers', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  ports:
    description: 'Port numbers'
    required: false
`,
        `
inputs:
  ports:
    type: string
    separators: ','
    items:
      type: number
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    ports: 8080, 9090, 3000
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    })

    it('should report errors for non-numeric values', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  ports:
    description: 'Port numbers'
    required: false
`,
        `
inputs:
  ports:
    type: string
    separators: ','
    items:
      type: number
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    ports: 8080, invalid, 3000
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toContain('expects number values')
      expect(errors[0].message).toContain('invalid')
    })
  })

  describe('Multi-value with boolean', () => {
    it('should validate comma-separated booleans', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  flags:
    description: 'Boolean flags'
    required: false
`,
        `
inputs:
  flags:
    type: string
    separators: ','
    items:
      type: boolean
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    flags: true, false, yes, no
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    })

    it('should report errors for non-boolean values', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  flags:
    description: 'Boolean flags'
    required: false
`,
        `
inputs:
  flags:
    type: string
    separators: ','
    items:
      type: boolean
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    flags: true, maybe, false
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toContain('expects boolean values')
      expect(errors[0].message).toContain('maybe')
    })
  })

  describe('Multi-value with expressions', () => {
    it('should skip validation for expressions', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  tags:
    description: 'Tags'
    required: false
`,
        `
inputs:
  tags:
    type: string
    separators: ','
    items:
      type: string
      match: "^[a-z0-9-]+$"
`
      )

      const yaml =
        '- uses: owner/test-action@v1\n' +
        '  with:\n' +
        '    tags: $' +
        '{{ inputs.tags }}\n'
      const schemas = new Map<string, ActionSchema>()

      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    })
  })

  describe('Semicolon separator', () => {
    it('should validate semicolon-separated values', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  items:
    description: 'Items'
    required: false
`,
        `
inputs:
  items:
    type: string
    separators: ';'
    items:
      type: string
      match: "^[A-Z]+$"
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    items: ABC; DEF; GHI
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    })
  })
})
