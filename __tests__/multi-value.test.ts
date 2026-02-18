import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  loadActionSchemaDefinition,
  resolveTypeDefinition,
} from '../src/schema-loader.js'
import { splitMultiValue } from '../src/value-normalizer.js'
import { loadActionSchema } from '../src/action-schema.js'

describe('Multi-value input support', () => {
  const testDir = '/tmp/multi-value-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('splitMultiValue', () => {
    it('should split newline-separated values', () => {
      const value = 'item1\nitem2\nitem3'
      const result = splitMultiValue(value, 'newline')
      expect(result).toEqual(['item1', 'item2', 'item3'])
    })

    it('should split comma-separated values', () => {
      const value = 'item1, item2, item3'
      const result = splitMultiValue(value, ',')
      expect(result).toEqual(['item1', 'item2', 'item3'])
    })

    it('should split semicolon-separated values', () => {
      const value = 'item1; item2; item3'
      const result = splitMultiValue(value, ';')
      expect(result).toEqual(['item1', 'item2', 'item3'])
    })

    it('should handle escaped separators', () => {
      const value = 'item1\\, with comma, item2'
      const result = splitMultiValue(value, ',')
      expect(result).toEqual(['item1, with comma', 'item2'])
    })

    it('should filter out empty items', () => {
      const value = 'item1,, item2,  ,item3'
      const result = splitMultiValue(value, ',')
      expect(result).toEqual(['item1', 'item2', 'item3'])
    })

    it('should handle comments in newline-separated values', () => {
      const value = 'item1 # comment\nitem2\nitem3 # another comment'
      const result = splitMultiValue(value, 'newline')
      expect(result).toEqual(['item1', 'item2', 'item3'])
    })

    it('should return null for expressions', () => {
      const value = '${{ inputs.items }}'
      const result = splitMultiValue(value, ',')
      expect(result).toBeNull()
    })

    it('should handle \\n as separator', () => {
      const value = 'item1\nitem2\nitem3'
      const result = splitMultiValue(value, '\\n')
      expect(result).toEqual(['item1', 'item2', 'item3'])
    })
  })

  describe('Schema definition with items', () => {
    it('should load schema with items and separator', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, 'name: Test\n')
      await fs.writeFile(
        schemaPath,
        `
inputs:
  tags:
    type: string
    separator: ','
    items:
      type: string
      match: "^[a-z]+$"
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      expect(schema?.inputs?.tags).toBeDefined()

      const tagsDef = schema?.inputs?.tags
      if (typeof tagsDef !== 'string') {
        expect(tagsDef?.type).toBe('string')
        expect(tagsDef?.separator).toBe(',')
        expect(tagsDef?.items).toBeDefined()
        expect(tagsDef?.items?.type).toBe('string')
        expect(tagsDef?.items?.match).toBe('^[a-z]+$')
      }
    })

    it('should default separator to newline when items is specified', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, 'name: Test\n')
      await fs.writeFile(
        schemaPath,
        `
inputs:
  tags:
    type: string
    items:
      type: string
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      const tagsDef = schema?.inputs?.tags
      if (typeof tagsDef !== 'string') {
        expect(tagsDef?.separator).toBe('newline')
      }
    })

    it('should support nested items with choice type', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, 'name: Test\n')
      await fs.writeFile(
        schemaPath,
        `
inputs:
  environments:
    type: string
    separator: ','
    items:
      type: choice
      options:
        - development
        - staging
        - production
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()

      const envDef = schema?.inputs?.environments
      if (typeof envDef !== 'string') {
        expect(envDef?.items?.type).toBe('choice')
        expect(envDef?.items?.options).toEqual([
          'development',
          'staging',
          'production',
        ])
      }
    })

    it('should resolve items in resolveTypeDefinition', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, 'name: Test\n')
      await fs.writeFile(
        schemaPath,
        `
inputs:
  tags:
    type: string
    separator: ','
    items:
      type: string
      match: "^[a-z]+$"
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()

      const tagsDef = schema?.inputs?.tags
      if (typeof tagsDef !== 'string') {
        const resolved = resolveTypeDefinition(tagsDef, {})
        expect(resolved.separator).toBe(',')
        expect(resolved.items).toBeDefined()
        expect(resolved.items?.type).toBe('string')
        expect(resolved.items?.match).toBeDefined()
        expect(resolved.items?.match?.test('abc')).toBe(true)
        expect(resolved.items?.match?.test('ABC')).toBe(false)
      }
    })
  })

  describe('Integration with action schema', () => {
    it('should load action schema with multi-value input', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(
        actionPath,
        `
name: Test Action
inputs:
  tags:
    description: 'List of tags'
    required: false
`
      )

      await fs.writeFile(
        schemaPath,
        `
inputs:
  tags:
    type: string
    separator: ','
    items:
      type: string
      match: "^[a-z0-9-]+$"
`
      )

      const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')
      const tagsInput = schema.inputs.get('tags')

      expect(tagsInput).toBeDefined()
      expect(tagsInput?.separator).toBe(',')
      expect(tagsInput?.items).toBeDefined()
      expect(tagsInput?.items?.type).toBe('string')
      expect(tagsInput?.items?.match).toBeDefined()
      expect(tagsInput?.items?.match?.test('tag-1')).toBe(true)
      expect(tagsInput?.items?.match?.test('TAG')).toBe(false)
    })
  })
})
