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

  it('should provide clear error message for alternatives with boolean value', async () => {
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

    await expect(loadActionSchemaDefinition(actionPath)).rejects.toThrow(
      /Choice option with value 'error' has invalid 'alternatives': expected an array of strings, but got an array with non-string elements\. Example: alternatives: \['option1', 'option2'\]/
    )
  })

  it('should provide clear error message when alternatives is a scalar instead of array', async () => {
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

    await expect(loadActionSchemaDefinition(actionPath)).rejects.toThrow(
      /Choice option with value 'error' has invalid 'alternatives': expected an array of strings, but got string\. Example: alternatives: \['option1', 'option2'\]/
    )
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
