import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { loadActionSchemaDefinition } from '../src/schema-loader.js'
import { loadActionSchema } from '../src/action-schema.js'
import { validateStep, findReferencedSteps } from '../src/validator.js'
import type { ActionSchema } from '../src/index.js'

describe('Any type support', () => {
  const testDir = '/tmp/any-type-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('Schema definition', () => {
    it('should load schema with any type', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, 'name: Test\n')
      await fs.writeFile(
        schemaPath,
        `
inputs:
  data:
    type: any
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      expect(schema?.inputs?.data).toBeDefined()

      const dataDef = schema?.inputs?.data
      if (typeof dataDef !== 'string') {
        expect(dataDef?.type).toBe('any')
      }
    })

    it('should support any type in custom types', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, 'name: Test\n')
      await fs.writeFile(
        schemaPath,
        `
types:
  flexible:
    type: any
inputs:
  data: flexible
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      expect(schema?.types?.flexible).toBeDefined()
      expect(schema?.types?.flexible.type).toBe('any')
      expect(schema?.inputs?.data).toBe('flexible')
    })
  })

  describe('Single-value validation', () => {
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

    it('should accept any string value', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  data:
    description: 'Any data'
    required: false
`,
        `
inputs:
  data:
    type: any
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    data: this can be anything!
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    })

    it('should accept numeric values', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  data:
    description: 'Any data'
    required: false
`,
        `
inputs:
  data:
    type: any
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    data: 12345
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    })

    it('should accept boolean values', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  data:
    description: 'Any data'
    required: false
`,
        `
inputs:
  data:
    type: any
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    data: true
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    })

    it('should accept multiline values', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  script:
    description: 'Any script'
    required: false
`,
        `
inputs:
  script:
    type: any
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    script: |
      echo "line 1"
      echo "line 2"
      any content here
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    })

    it('should accept special characters', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  data:
    description: 'Any data'
    required: false
`,
        `
inputs:
  data:
    type: any
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    data: "!@#$%^&*()_+-=[]{}|;':,.<>?/~\`"
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    })
  })

  describe('Multi-value with any type', () => {
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

    it('should accept any values in comma-separated list', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  items:
    description: 'Any items'
    required: false
`,
        `
inputs:
  items:
    type: string
    separators: ','
    items:
      type: any
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    items: value1, 123, true, special!@#, another-value
`
      const schemas = new Map<string, ActionSchema>()
      schemas.set('owner/test-action', schema)

      const steps = findReferencedSteps(yaml, schemas)
      expect(steps).toHaveLength(1)

      const errors = validateStep(steps[0], schema, 1)
      expect(errors).toHaveLength(0)
    })

    it('should accept any values in newline-separated list', async () => {
      const schema = await createTestAction(
        `
name: Test Action
inputs:
  lines:
    description: 'Any lines'
    required: false
`,
        `
inputs:
  lines:
    type: string
    separators: newline
    items:
      type: any
`
      )

      const yaml = `
- uses: owner/test-action@v1
  with:
    lines: |
      first line
      123
      true
      special!@#$
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
