import { describe, expect, it, beforeEach, afterEach } from '@jest/globals'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { loadActionSchemaDefinition } from '../src/schema-loader.js'

describe('Schema Error Reporting', () => {
  const testDir = '/tmp/schema-error-test'

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should accept boolean values in alternatives and convert to strings', async () => {
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
        alternatives:
          - true
      - value: warning
        description: Report as warning but allow validation to pass
      - value: none
        description: Skip this validation check
        alternatives:
          - none
`
    )

    // Should NOT throw - booleans are now accepted and converted to strings
    const schema = await loadActionSchemaDefinition(actionPath)
    expect(schema).not.toBeNull()
    expect(schema?.types?.['validation-level']).toBeDefined()
    
    const typeDef = schema?.types?.['validation-level']
    if (typeof typeDef !== 'string') {
      const options = typeDef?.options
      expect(options).toBeDefined()
      if (options) {
        const firstOption = options[0]
        if (typeof firstOption !== 'string') {
          // The boolean true should be converted to the string 'true'
          expect(firstOption?.alternatives).toEqual(['true'])
        }
      }
    }
  })

  it('should accept single string value for alternatives (not an error)', async () => {
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
        alternatives: enabled
`
    )

    // Should NOT throw - single string is valid and will be normalized to array
    const schema = await loadActionSchemaDefinition(actionPath)
    expect(schema).not.toBeNull()
  })

  it('should provide correct format for valid alternatives', async () => {
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
        alternatives:
          - 'true'
          - enabled
      - value: warning
        description: Report as warning but allow validation to pass
      - value: none
        description: Skip this validation check
        alternatives:
          - disabled
`
    )

    const schema = await loadActionSchemaDefinition(actionPath)
    expect(schema).not.toBeNull()
    expect(schema?.types?.['validation-level']).toBeDefined()
  })
})
