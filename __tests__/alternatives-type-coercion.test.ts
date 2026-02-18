import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  loadActionSchemaDefinition,
  resolveTypeDefinition,
} from '../src/schema-loader.js'

describe('Alternatives Type Coercion', () => {
  const testDir = '/tmp/alternatives-coercion-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('Boolean values', () => {
    it('should accept and convert boolean true to string', async () => {
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
      - value: error
        alternatives: true
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      const levelDef = schema?.inputs?.level
      if (typeof levelDef !== 'string') {
        const option = levelDef?.options?.[0]
        if (typeof option !== 'string') {
          expect(option?.alternatives).toEqual(['true'])
        }
      }
    })

    it('should accept and convert boolean false to string', async () => {
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
      - value: error
        alternatives: false
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      const levelDef = schema?.inputs?.level
      if (typeof levelDef !== 'string') {
        const option = levelDef?.options?.[0]
        if (typeof option !== 'string') {
          expect(option?.alternatives).toEqual(['false'])
        }
      }
    })

    it('should convert booleans in array to strings', async () => {
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
      - value: error
        alternatives: [true, false]
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      const levelDef = schema?.inputs?.level
      if (typeof levelDef !== 'string') {
        const option = levelDef?.options?.[0]
        if (typeof option !== 'string') {
          expect(option?.alternatives).toEqual(['true', 'false'])
        }
      }
    })
  })

  describe('Numeric values', () => {
    it('should accept and convert integer to string', async () => {
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
      - value: error
        alternatives: 123
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      const levelDef = schema?.inputs?.level
      if (typeof levelDef !== 'string') {
        const option = levelDef?.options?.[0]
        if (typeof option !== 'string') {
          expect(option?.alternatives).toEqual(['123'])
        }
      }
    })

    it('should accept and convert zero to string', async () => {
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
      - value: error
        alternatives: 0
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      const levelDef = schema?.inputs?.level
      if (typeof levelDef !== 'string') {
        const option = levelDef?.options?.[0]
        if (typeof option !== 'string') {
          expect(option?.alternatives).toEqual(['0'])
        }
      }
    })

    it('should accept and convert negative number to string', async () => {
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
      - value: error
        alternatives: -1
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      const levelDef = schema?.inputs?.level
      if (typeof levelDef !== 'string') {
        const option = levelDef?.options?.[0]
        if (typeof option !== 'string') {
          expect(option?.alternatives).toEqual(['-1'])
        }
      }
    })

    it('should convert numbers in array to strings', async () => {
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
      - value: error
        alternatives: [1, 2, 3]
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      const levelDef = schema?.inputs?.level
      if (typeof levelDef !== 'string') {
        const option = levelDef?.options?.[0]
        if (typeof option !== 'string') {
          expect(option?.alternatives).toEqual(['1', '2', '3'])
        }
      }
    })
  })

  describe('Null and undefined', () => {
    it('should accept and convert null to string', async () => {
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
      - value: error
        alternatives: null
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      const levelDef = schema?.inputs?.level
      if (typeof levelDef !== 'string') {
        const option = levelDef?.options?.[0]
        if (typeof option !== 'string') {
          expect(option?.alternatives).toEqual(['null'])
        }
      }
    })

    it('should handle null in array', async () => {
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
      - value: error
        alternatives: [null, enabled]
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      const levelDef = schema?.inputs?.level
      if (typeof levelDef !== 'string') {
        const option = levelDef?.options?.[0]
        if (typeof option !== 'string') {
          expect(option?.alternatives).toEqual(['null', 'enabled'])
        }
      }
    })
  })

  describe('Mixed types', () => {
    it('should handle mixed types in array', async () => {
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
      - value: error
        alternatives: [true, 1, enabled, false, 0]
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      const levelDef = schema?.inputs?.level
      if (typeof levelDef !== 'string') {
        const option = levelDef?.options?.[0]
        if (typeof option !== 'string') {
          expect(option?.alternatives).toEqual([
            'true',
            '1',
            'enabled',
            'false',
            '0',
          ])
        }
      }
    })
  })

  describe('Resolution and flattening', () => {
    it('should flatten converted alternatives during resolution', async () => {
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
      - value: error
        alternatives: true
      - value: warning
        alternatives: [1, 2]
      - simple
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      const levelDef = schema?.inputs?.level
      if (typeof levelDef !== 'string') {
        const resolved = resolveTypeDefinition(levelDef, {})
        // Should flatten: error, true, warning, 1, 2, simple
        expect(resolved.options).toEqual([
          'error',
          'true',
          'warning',
          '1',
          '2',
          'simple',
        ])
      }
    })
  })

  describe('Real-world use case from semver-checker', () => {
    it('should accept the validation-level type with boolean alternatives', async () => {
      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, 'name: Test\n')
      await fs.writeFile(
        schemaPath,
        `
types:
  validation-level:
    type: choice
    options:
      - value: error
        description: Report as error and fail validation
        alternatives: true
      - value: warning
        description: Report as warning but allow validation to pass
      - value: none
        description: Skip this validation check
        alternatives: false
`
      )

      const schema = await loadActionSchemaDefinition(actionPath)
      expect(schema).not.toBeNull()
      expect(schema?.types?.['validation-level']).toBeDefined()

      const typeDef = schema?.types?.['validation-level']
      if (typeof typeDef !== 'string') {
        const resolved = resolveTypeDefinition(typeDef, schema?.types || {})
        // Should flatten: error, true, warning, none, false
        expect(resolved.options).toEqual([
          'error',
          'true',
          'warning',
          'none',
          'false',
        ])
      }
    })
  })
})
