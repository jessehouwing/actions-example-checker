import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  loadActionSchemaDefinition,
  resolveTypeDefinition,
} from '../src/schema-loader.js'

describe('loadActionSchemaDefinition', () => {
  const testDir = '/tmp/schema-loader-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should return null if no schema file exists', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    await fs.writeFile(actionPath, 'name: Test\n')

    const schema = await loadActionSchemaDefinition(actionPath)
    expect(schema).toBeNull()
  })

  it('should load schema from .yml file', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  debug:
    type: boolean
`
    )

    const schema = await loadActionSchemaDefinition(actionPath)
    expect(schema).not.toBeNull()
    expect(schema?.inputs?.debug).toBeDefined()
  })

  it('should load schema from .yaml file', async () => {
    const actionPath = path.join(testDir, 'action.yaml')
    const schemaPath = path.join(testDir, 'action.schema.yaml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  debug:
    type: boolean
`
    )

    const schema = await loadActionSchemaDefinition(actionPath)
    expect(schema).not.toBeNull()
    expect(schema?.inputs?.debug).toBeDefined()
  })

  it('should load schema with custom types', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
types:
  url:
    type: string
    match: "^https?://.*"
inputs:
  homepage: url
`
    )

    const schema = await loadActionSchemaDefinition(actionPath)
    expect(schema).not.toBeNull()
    expect(schema?.types?.url).toBeDefined()
    expect(schema?.types?.url.type).toBe('string')
    expect(schema?.types?.url.match).toBe('^https?://.*')
    expect(schema?.inputs?.homepage).toBe('url')
  })

  it('should load schema with choice type', async () => {
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

  it('should validate that choice type requires options', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  level:
    type: choice
`
    )

    await expect(loadActionSchemaDefinition(actionPath)).rejects.toThrow(
      'choice type requires options array'
    )
  })

  it('should validate that match is only for string type', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  debug:
    type: boolean
    match: ".*"
`
    )

    await expect(loadActionSchemaDefinition(actionPath)).rejects.toThrow(
      'match can only be used with string type'
    )
  })

  it('should validate that options is only for choice type', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  count:
    type: number
    options:
      - 1
      - 2
`
    )

    await expect(loadActionSchemaDefinition(actionPath)).rejects.toThrow(
      'options can only be used with choice type'
    )
  })

  it('should reject invalid type on resolution', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
inputs:
  value:
    type: invalid
`
    )

    const schema = await loadActionSchemaDefinition(actionPath)
    expect(schema).not.toBeNull()

    // Should fail when trying to resolve the unknown type reference
    const inputDef = schema?.inputs?.value
    if (typeof inputDef !== 'string') {
      expect(() =>
        resolveTypeDefinition(inputDef!, schema?.types || {})
      ).toThrow('Unknown custom type: invalid')
    }
  })

  it('should load schema with outputs', async () => {
    const actionPath = path.join(testDir, 'action.yml')
    const schemaPath = path.join(testDir, 'action.schema.yml')

    await fs.writeFile(actionPath, 'name: Test\n')
    await fs.writeFile(
      schemaPath,
      `
outputs:
  result:
    type: string
  count:
    type: number
`
    )

    const schema = await loadActionSchemaDefinition(actionPath)
    expect(schema).not.toBeNull()
    expect(schema?.outputs?.result).toBeDefined()
    expect(schema?.outputs?.count).toBeDefined()
  })
})

describe('resolveTypeDefinition', () => {
  it('should resolve custom type reference', () => {
    const customTypes = {
      url: {
        type: 'string' as const,
        match: '^https?://.*',
      },
    }

    const resolved = resolveTypeDefinition('url', customTypes)
    expect(resolved.type).toBe('string')
    expect(resolved.match).toBeDefined()
  })

  it('should throw error for unknown custom type', () => {
    const customTypes = {}

    expect(() => resolveTypeDefinition('unknown', customTypes)).toThrow(
      'Unknown custom type: unknown'
    )
  })

  it('should resolve direct type definition', () => {
    const typeDef = {
      type: 'boolean' as const,
    }

    const resolved = resolveTypeDefinition(typeDef, {})
    expect(resolved.type).toBe('boolean')
  })

  it('should compile regex pattern', () => {
    const typeDef = {
      type: 'string' as const,
      match: '^test.*',
    }

    const resolved = resolveTypeDefinition(typeDef, {})
    expect(resolved.match).toBeInstanceOf(RegExp)
    expect(resolved.match?.test('test123')).toBe(true)
    expect(resolved.match?.test('xyz')).toBe(false)
  })

  it('should compile regex with flags', () => {
    const typeDef = {
      type: 'string' as const,
      match: '/test/i',
    }

    const resolved = resolveTypeDefinition(typeDef, {})
    expect(resolved.match).toBeInstanceOf(RegExp)
    expect(resolved.match?.test('TEST')).toBe(true)
    expect(resolved.match?.test('test')).toBe(true)
  })

  it('should copy options for choice type', () => {
    const typeDef = {
      type: 'choice' as const,
      options: ['a', 'b', 'c'],
    }

    const resolved = resolveTypeDefinition(typeDef, {})
    expect(resolved.options).toEqual(['a', 'b', 'c'])
  })
})
