import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  loadActionSchemaDefinition,
  resolveTypeDefinition,
} from '../src/schema-loader.js'
import { loadActionSchema } from '../src/action-schema.js'

describe('Type references with separators', () => {
  const testDir = '/tmp/type-ref-separator-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('Input referencing type with added separators', () => {
    it('should allow adding separators to a type without separators', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, 'name: Test\n')
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

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      expect(schema?.types?.version).toBeDefined()
      expect(schema?.inputs?.['ignore-versions']).toBeDefined()

      const inputDef = schema?.inputs?.['ignore-versions']
      if (typeof inputDef !== 'string') {
        expect(inputDef?.type).toBe('version')
        expect(inputDef?.separators).toEqual(['newline', ','])

        // Resolve the type to check the merged result
        const resolved = resolveTypeDefinition(
          inputDef!,
          schema?.types || {}
        )
        expect(resolved.type).toBe('string')
        expect(resolved.match).toBeDefined()
        expect(resolved.match?.test('v1.0.0')).toBe(true)
        expect(resolved.separators).toEqual(['newline', ','])
      }
    })

    it('should allow overriding separators from a type', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, 'name: Test\n')
      await fs.writeFile(
        schemaPath,
        `
types:
  versions:
    type: string
    separators: newline
    match: '^v?\\d+(\\.\\d+)?(\\.\\d+)?$'

inputs:
  alternative-separator-override:
    type: versions
    separators: ","
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()

      const inputDef = schema?.inputs?.['alternative-separator-override']
      if (typeof inputDef !== 'string') {
        expect(inputDef?.type).toBe('versions')
        expect(inputDef?.separators).toBe(',')

        // Resolve to check override worked
        const resolved = resolveTypeDefinition(
          inputDef!,
          schema?.types || {}
        )
        expect(resolved.type).toBe('string')
        expect(resolved.match).toBeDefined()
        expect(resolved.separators).toEqual([',']) // Overridden, not ['newline']
      }
    })

    it('should work with action schema integration', async () => {
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
  version:
    description: 'Single version'
    required: false
  alternative:
    description: 'Alternative versions'
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
  
  versions:
    type: string
    separators: newline
    match: '^v?\\d+(\\.\\d+)?(\\.\\d+)?$'

inputs:
  ignore-versions:
    type: version
    separators: ['newline', ',']
  
  version:
    type: version
  
  alternative:
    type: versions
`
      )

      const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

      // Check ignore-versions input
      const ignoreVersions = schema.inputs.get('ignore-versions')
      expect(ignoreVersions).toBeDefined()
      expect(ignoreVersions?.type).toBe('string')
      expect(ignoreVersions?.match).toBeDefined()
      expect(ignoreVersions?.match?.test('v1.0.0')).toBe(true)
      expect(ignoreVersions?.separators).toEqual(['newline', ','])

      // Check version input (single version, no separators)
      const version = schema.inputs.get('version')
      expect(version).toBeDefined()
      expect(version?.type).toBe('string')
      expect(version?.match).toBeDefined()
      expect(version?.match?.test('2.1.0')).toBe(true)
      expect(version?.separators).toBeUndefined()

      // Check alternative input (inherits separators from versions type)
      const alternative = schema.inputs.get('alternative')
      expect(alternative).toBeDefined()
      expect(alternative?.type).toBe('string')
      expect(alternative?.match).toBeDefined()
      expect(alternative?.separators).toEqual(['newline'])
    })
  })

  describe('Complex type reference scenarios', () => {
    it('should handle nested type references', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, 'name: Test\n')
      await fs.writeFile(
        schemaPath,
        `
types:
  base-string:
    type: string
    match: '^[a-z]+$'
  
  extended-string:
    type: base-string

inputs:
  my-input:
    type: extended-string
    separators: ','
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()

      const inputDef = schema?.inputs?.['my-input']
      if (typeof inputDef !== 'string') {
        const resolved = resolveTypeDefinition(
          inputDef!,
          schema?.types || {}
        )
        expect(resolved.type).toBe('string')
        expect(resolved.match).toBeDefined()
        expect(resolved.match?.test('abc')).toBe(true)
        expect(resolved.match?.test('ABC')).toBe(false)
        expect(resolved.separators).toEqual([','])
      }
    })

    it('should allow overriding match pattern from referenced type', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, 'name: Test\n')
      await fs.writeFile(
        schemaPath,
        `
types:
  version:
    type: string
    match: '^v?\\d+$'

inputs:
  extended-version:
    type: version
    match: '^v?\\d+\\.\\d+\\.\\d+$'
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()

      const inputDef = schema?.inputs?.['extended-version']
      if (typeof inputDef !== 'string') {
        const resolved = resolveTypeDefinition(
          inputDef!,
          schema?.types || {}
        )
        expect(resolved.type).toBe('string')
        expect(resolved.match).toBeDefined()
        expect(resolved.match?.test('v1.2.3')).toBe(true)
        expect(resolved.match?.test('v1')).toBe(false) // Override worked
      }
    })

    it('should handle type reference with items', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, 'name: Test\n')
      await fs.writeFile(
        schemaPath,
        `
types:
  tag:
    type: string
    match: '^[a-z0-9-]+$'

inputs:
  tags:
    type: tag
    separators: ','
    items:
      type: string
      match: '^[a-z0-9-]+$'
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()

      const inputDef = schema?.inputs?.['tags']
      if (typeof inputDef !== 'string') {
        const resolved = resolveTypeDefinition(
          inputDef!,
          schema?.types || {}
        )
        expect(resolved.type).toBe('string')
        expect(resolved.separators).toEqual([','])
        expect(resolved.items).toBeDefined()
        expect(resolved.items?.type).toBe('string')
        expect(resolved.items?.match).toBeDefined()
      }
    })
  })

  describe('Error handling', () => {
    it('should throw error for unknown custom type reference', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, 'name: Test\n')
      await fs.writeFile(
        schemaPath,
        `
inputs:
  my-input:
    type: unknown-type
    separators: ','
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()

      const inputDef = schema?.inputs?.['my-input']
      if (typeof inputDef !== 'string') {
        expect(() =>
          resolveTypeDefinition(inputDef!, schema?.types || {})
        ).toThrow('Unknown custom type: unknown-type')
      }
    })

    it('should throw error for nested unknown custom type', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, 'name: Test\n')
      await fs.writeFile(
        schemaPath,
        `
types:
  my-type:
    type: unknown-base-type

inputs:
  my-input:
    type: my-type
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()

      const inputDef = schema?.inputs?.['my-input']
      if (typeof inputDef !== 'string') {
        expect(() =>
          resolveTypeDefinition(inputDef!, schema?.types || {})
        ).toThrow('Unknown custom type: unknown-base-type')
      }
    })
  })

  describe('Direct string reference should still work', () => {
    it('should resolve direct string reference to custom type', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, 'name: Test\n')
      await fs.writeFile(
        schemaPath,
        `
types:
  url:
    type: string
    match: '^https?://.*'

inputs:
  homepage: url
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      expect(schema?.inputs?.homepage).toBe('url')

      const resolved = resolveTypeDefinition('url', schema?.types || {})
      expect(resolved.type).toBe('string')
      expect(resolved.match).toBeDefined()
      expect(resolved.match?.test('https://example.com')).toBe(true)
    })
  })
})
