import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  loadActionSchemaDefinition,
  resolveTypeDefinition,
} from '../src/schema-loader.js'
import { loadActionSchema } from '../src/action-schema.js'
import { findReferencedSteps, validateStep } from '../src/validator.js'

describe('Choice Options with Descriptions and Alternatives', () => {
  const testDir = '/tmp/choice-alternatives-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should support simple string options (backward compatibility)', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  level:
    type: choice
    options:
      - info
      - warning
      - error
`
    )

    const schema = await loadActionSchemaDefinition(actionPath)
    expect(schema).not.toBeNull()
    expect(schema?.inputs?.level).toBeDefined()
    const levelDef = schema?.inputs?.level
    if (typeof levelDef !== 'string') {
      expect(levelDef?.type).toBe('choice')
      expect(levelDef?.options).toEqual(['info', 'warning', 'error'])
    }
  })

  it('should support object options with value only', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  level:
    type: choice
    options:
      - value: info
      - value: warning
      - value: error
`
    )

    const schema = await loadActionSchemaDefinition(actionPath)
    expect(schema).not.toBeNull()
    const levelDef = schema?.inputs?.level
    if (typeof levelDef !== 'string') {
      expect(levelDef?.options).toHaveLength(3)
      expect(levelDef?.options?.[0]).toEqual({ value: 'info' })
      expect(levelDef?.options?.[1]).toEqual({ value: 'warning' })
      expect(levelDef?.options?.[2]).toEqual({ value: 'error' })
    }
  })

  it('should support object options with value and description', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  environment:
    type: choice
    options:
      - value: dev
        description: Development environment
      - value: prod
        description: Production environment
`
    )

    const schema = await loadActionSchemaDefinition(actionPath)
    expect(schema).not.toBeNull()
    const envDef = schema?.inputs?.environment
    if (typeof envDef !== 'string') {
      expect(envDef?.options).toHaveLength(2)
      expect(envDef?.options?.[0]).toEqual({
        value: 'dev',
        description: 'Development environment',
      })
      expect(envDef?.options?.[1]).toEqual({
        value: 'prod',
        description: 'Production environment',
      })
    }
  })

  it('should support object options with value and alternatives', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  with-options:
    type: choice
    options:
      - value: a
        alternatives:
          - b
          - c
      - value: d
        alternatives:
          - e
          - f
      - g
`
    )

    const schema = await loadActionSchemaDefinition(actionPath)
    expect(schema).not.toBeNull()
    const optDef = schema?.inputs?.['with-options']
    if (typeof optDef !== 'string') {
      expect(optDef?.options).toHaveLength(3)
      expect(optDef?.options?.[0]).toEqual({
        value: 'a',
        alternatives: ['b', 'c'],
      })
      expect(optDef?.options?.[1]).toEqual({
        value: 'd',
        alternatives: ['e', 'f'],
      })
      expect(optDef?.options?.[2]).toBe('g')
    }
  })

  it('should support object options with all properties', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  with-options:
    type: choice
    options:
      - value: a
        description: this does X
        alternatives:
          - b
          - c
      - value: d
        description: this does Y
        alternatives:
          - e
          - f
      - g
`
    )

    const schema = await loadActionSchemaDefinition(actionPath)
    expect(schema).not.toBeNull()
    const optDef = schema?.inputs?.['with-options']
    if (typeof optDef !== 'string') {
      expect(optDef?.options).toHaveLength(3)
      expect(optDef?.options?.[0]).toEqual({
        value: 'a',
        description: 'this does X',
        alternatives: ['b', 'c'],
      })
      expect(optDef?.options?.[1]).toEqual({
        value: 'd',
        description: 'this does Y',
        alternatives: ['e', 'f'],
      })
      expect(optDef?.options?.[2]).toBe('g')
    }
  })

  it('should throw error if option object missing value', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  level:
    type: choice
    options:
      - description: Info level
`
    )

    await expect(loadActionSchemaDefinition(actionPath)).rejects.toThrow(
      "Choice option must have a 'value' string property"
    )
  })

  it('should throw error if description is not a string', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  level:
    type: choice
    options:
      - value: info
        description: 123
`
    )

    await expect(loadActionSchemaDefinition(actionPath)).rejects.toThrow(
      "Choice option 'description' must be a string if provided"
    )
  })

  it('should throw error if alternatives is not an array', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  level:
    type: choice
    options:
      - value: info
        alternatives: notanarray
`
    )

    await expect(loadActionSchemaDefinition(actionPath)).rejects.toThrow(
      "Choice option 'alternatives' must be an array of strings if provided"
    )
  })

  it('should throw error if alternatives contains non-strings', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  level:
    type: choice
    options:
      - value: info
        alternatives:
          - warn
          - 123
`
    )

    await expect(loadActionSchemaDefinition(actionPath)).rejects.toThrow(
      "Choice option 'alternatives' must be an array of strings if provided"
    )
  })

  it('should flatten alternatives when resolving type definition', () => {
    const typeDef = {
      type: 'choice' as const,
      options: [
        {
          value: 'a',
          alternatives: ['b', 'c'],
        },
        {
          value: 'd',
          alternatives: ['e', 'f'],
        },
        'g',
      ],
    }

    const resolved = resolveTypeDefinition(typeDef, {})
    expect(resolved.options).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
  })

  it('should validate inputs accepting primary values', async () => {
    const actionYml = `
name: Test Action
inputs:
  with-options:
    description: Options with alternatives
    required: true
`

    const schemaYml = `
inputs:
  with-options:
    type: choice
    options:
      - value: a
        description: this does X
        alternatives:
          - b
          - c
      - value: d
        description: this does Y
        alternatives:
          - e
          - f
      - g
`

    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')
    await fs.writeFile(actionPath, actionYml)
    await fs.writeFile(schemaPath, schemaYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')
    const schemas = new Map([['owner/repo', schema]])

    // Test with primary value 'a'
    const yamlA = `
- uses: owner/repo@v1
  with:
    with-options: a
`
    const stepsA = findReferencedSteps(yamlA, schemas)
    expect(stepsA).toHaveLength(1)
    const errorsA = validateStep(stepsA[0], schema, 1)
    expect(errorsA).toHaveLength(0)

    // Test with primary value 'd'
    const yamlD = `
- uses: owner/repo@v1
  with:
    with-options: d
`
    const stepsD = findReferencedSteps(yamlD, schemas)
    const errorsD = validateStep(stepsD[0], schema, 1)
    expect(errorsD).toHaveLength(0)

    // Test with simple string option 'g'
    const yamlG = `
- uses: owner/repo@v1
  with:
    with-options: g
`
    const stepsG = findReferencedSteps(yamlG, schemas)
    const errorsG = validateStep(stepsG[0], schema, 1)
    expect(errorsG).toHaveLength(0)
  })

  it('should validate inputs accepting alternative values', async () => {
    const actionYml = `
name: Test Action
inputs:
  with-options:
    description: Options with alternatives
    required: true
`

    const schemaYml = `
inputs:
  with-options:
    type: choice
    options:
      - value: a
        description: this does X
        alternatives:
          - b
          - c
      - value: d
        description: this does Y
        alternatives:
          - e
          - f
      - g
`

    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')
    await fs.writeFile(actionPath, actionYml)
    await fs.writeFile(schemaPath, schemaYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')
    const schemas = new Map([['owner/repo', schema]])

    // Test with alternative 'b' (alternative for 'a')
    const yamlB = `
- uses: owner/repo@v1
  with:
    with-options: b
`
    const stepsB = findReferencedSteps(yamlB, schemas)
    expect(stepsB).toHaveLength(1)
    const errorsB = validateStep(stepsB[0], schema, 1)
    expect(errorsB).toHaveLength(0)

    // Test with alternative 'c' (alternative for 'a')
    const yamlC = `
- uses: owner/repo@v1
  with:
    with-options: c
`
    const stepsC = findReferencedSteps(yamlC, schemas)
    const errorsC = validateStep(stepsC[0], schema, 1)
    expect(errorsC).toHaveLength(0)

    // Test with alternative 'e' (alternative for 'd')
    const yamlE = `
- uses: owner/repo@v1
  with:
    with-options: e
`
    const stepsE = findReferencedSteps(yamlE, schemas)
    const errorsE = validateStep(stepsE[0], schema, 1)
    expect(errorsE).toHaveLength(0)

    // Test with alternative 'f' (alternative for 'd')
    const yamlF = `
- uses: owner/repo@v1
  with:
    with-options: f
`
    const stepsF = findReferencedSteps(yamlF, schemas)
    const errorsF = validateStep(stepsF[0], schema, 1)
    expect(errorsF).toHaveLength(0)
  })

  it('should reject invalid values not in options or alternatives', async () => {
    const actionYml = `
name: Test Action
inputs:
  with-options:
    description: Options with alternatives
    required: true
`

    const schemaYml = `
inputs:
  with-options:
    type: choice
    options:
      - value: a
        alternatives:
          - b
          - c
      - value: d
        alternatives:
          - e
          - f
      - g
`

    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')
    await fs.writeFile(actionPath, actionYml)
    await fs.writeFile(schemaPath, schemaYml)

    const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')
    const schemas = new Map([['owner/repo', schema]])

    // Test with invalid value 'h'
    const yamlH = `
- uses: owner/repo@v1
  with:
    with-options: h
`
    const stepsH = findReferencedSteps(yamlH, schemas)
    expect(stepsH).toHaveLength(1)
    const errorsH = validateStep(stepsH[0], schema, 1)
    expect(errorsH.length).toBeGreaterThan(0)
    expect(errorsH[0].message).toContain('expects one of')
    expect(errorsH[0].message).toContain('a, b, c, d, e, f, g')
  })

  it('should work with mixed string and object options', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  mixed:
    type: choice
    options:
      - simple1
      - value: complex
        description: A complex option
        alternatives:
          - alias1
          - alias2
      - simple2
`
    )

    const schema = await loadActionSchemaDefinition(actionPath)
    expect(schema).not.toBeNull()
    const mixedDef = schema?.inputs?.mixed
    if (typeof mixedDef !== 'string') {
      expect(mixedDef?.options).toHaveLength(3)
      expect(mixedDef?.options?.[0]).toBe('simple1')
      expect(mixedDef?.options?.[1]).toEqual({
        value: 'complex',
        description: 'A complex option',
        alternatives: ['alias1', 'alias2'],
      })
      expect(mixedDef?.options?.[2]).toBe('simple2')
    }

    // Verify resolution flattens correctly
    if (typeof mixedDef !== 'string') {
      const resolved = resolveTypeDefinition(mixedDef, {})
      expect(resolved.options).toEqual([
        'simple1',
        'complex',
        'alias1',
        'alias2',
        'simple2',
      ])
    }
  })
})
