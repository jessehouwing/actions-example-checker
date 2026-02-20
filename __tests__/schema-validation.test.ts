import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Create mock functions for @actions/core
const mockWarning = jest.fn()
const mockError = jest.fn()
const mockInfo = jest.fn()
const mockDebug = jest.fn()
const mockSetFailed = jest.fn()

// Mock @actions/core module
jest.unstable_mockModule('@actions/core', () => ({
  warning: mockWarning,
  error: mockError,
  info: mockInfo,
  debug: mockDebug,
  setFailed: mockSetFailed,
  getInput: jest.fn(() => ''),
}))

// Import after mocking
const { loadActionSchema } = await import('../src/action-schema.js')

describe('Schema Validation', () => {
  const testDir = path.join(tmpdir(), 'schema-validation-test')

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true })

    // Clear all mocks
    mockWarning.mockClear()
    mockError.mockClear()
    mockInfo.mockClear()
    mockDebug.mockClear()
    mockSetFailed.mockClear()
  })

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('ERROR cases - schema has fields not in action.yml', () => {
    it('should throw error when schema defines input not in action.yml', async () => {
      const actionYml = `
name: Test Action
inputs:
  existing-input:
    description: An existing input
    required: true
`
      const schemaYml = `
inputs:
  existing-input:
    type: string
  non-existent-input:
    type: string
`

      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, actionYml)
      await fs.writeFile(schemaPath, schemaYml)

      await expect(
        loadActionSchema(actionPath, testDir, 'owner/repo')
      ).rejects.toThrow(
        "Schema defines input 'non-existent-input' that does not exist in action.yml"
      )
    })

    it('should throw error when schema defines output not in action.yml', async () => {
      const actionYml = `
name: Test Action
outputs:
  existing-output:
    description: An existing output
`
      const schemaYml = `
outputs:
  existing-output:
    type: string
  non-existent-output:
    type: string
`

      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, actionYml)
      await fs.writeFile(schemaPath, schemaYml)

      await expect(
        loadActionSchema(actionPath, testDir, 'owner/repo')
      ).rejects.toThrow(
        "Schema defines output 'non-existent-output' that does not exist in action.yml"
      )
    })

    it('should throw error when schema defines multiple inputs not in action.yml', async () => {
      const actionYml = `
name: Test Action
inputs:
  existing-input:
    description: An existing input
    required: true
`
      const schemaYml = `
inputs:
  existing-input:
    type: string
  missing-input-1:
    type: string
  missing-input-2:
    type: number
`

      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, actionYml)
      await fs.writeFile(schemaPath, schemaYml)

      await expect(
        loadActionSchema(actionPath, testDir, 'owner/repo')
      ).rejects.toThrow(/Schema defines input .* that does not exist in action.yml/)
    })
  })

  describe('WARNING cases - action.yml has fields not in schema', () => {
    it('should warn when action.yml has input not in schema', async () => {
      const actionYml = `
name: Test Action
inputs:
  documented-input:
    description: A documented input
    required: true
  undocumented-input:
    description: An undocumented input
    required: false
`
      const schemaYml = `
inputs:
  documented-input:
    type: string
`

      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, actionYml)
      await fs.writeFile(schemaPath, schemaYml)

      const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

      // Verify the schema was loaded successfully
      expect(schema.inputs.size).toBe(2)
      expect(schema.inputs.has('documented-input')).toBe(true)
      expect(schema.inputs.has('undocumented-input')).toBe(true)

      // Check for warning call
      expect(mockWarning).toHaveBeenCalledWith(
        expect.stringContaining("Input 'undocumented-input' in action.yml is not defined in schema"),
        expect.objectContaining({ file: expect.stringContaining('action.yml') })
      )
    })

    it('should warn when action.yml has output not in schema', async () => {
      const actionYml = `
name: Test Action
outputs:
  documented-output:
    description: A documented output
  undocumented-output:
    description: An undocumented output
`
      const schemaYml = `
outputs:
  documented-output:
    type: string
`

      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, actionYml)
      await fs.writeFile(schemaPath, schemaYml)

      const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

      // Verify the schema was loaded successfully
      expect(schema.outputs.size).toBe(2)
      expect(schema.outputs.has('documented-output')).toBe(true)
      expect(schema.outputs.has('undocumented-output')).toBe(true)

      // Check for warning call
      expect(mockWarning).toHaveBeenCalledWith(
        expect.stringContaining("Output 'undocumented-output' in action.yml is not defined in schema"),
        expect.objectContaining({ file: expect.stringContaining('action.yml') })
      )
    })

    it('should warn for multiple undocumented inputs and outputs', async () => {
      const actionYml = `
name: Test Action
inputs:
  input-1:
    description: Input 1
  input-2:
    description: Input 2
  input-3:
    description: Input 3
outputs:
  output-1:
    description: Output 1
  output-2:
    description: Output 2
`
      const schemaYml = `
inputs:
  input-1:
    type: string
outputs:
  output-1:
    type: string
`

      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, actionYml)
      await fs.writeFile(schemaPath, schemaYml)

      const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

      // Verify the schema was loaded successfully
      expect(schema.inputs.size).toBe(3)
      expect(schema.outputs.size).toBe(2)

      // Check for warning calls
      expect(mockWarning).toHaveBeenCalledWith(
        expect.stringContaining("Input 'input-2'"),
        expect.any(Object)
      )
      expect(mockWarning).toHaveBeenCalledWith(
        expect.stringContaining("Input 'input-3'"),
        expect.any(Object)
      )
      expect(mockWarning).toHaveBeenCalledWith(
        expect.stringContaining("Output 'output-2'"),
        expect.any(Object)
      )
    })
  })

  describe('SUCCESS cases - perfect alignment', () => {
    it('should succeed when all inputs and outputs are aligned', async () => {
      const actionYml = `
name: Test Action
inputs:
  input-1:
    description: Input 1
    required: true
  input-2:
    description: Input 2
    required: false
outputs:
  output-1:
    description: Output 1
  output-2:
    description: Output 2
`
      const schemaYml = `
inputs:
  input-1:
    type: string
  input-2:
    type: number
outputs:
  output-1:
    type: string
  output-2:
    type: boolean
`

      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, actionYml)
      await fs.writeFile(schemaPath, schemaYml)

      const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

      // Verify the schema was loaded successfully
      expect(schema.inputs.size).toBe(2)
      expect(schema.outputs.size).toBe(2)

      // No warnings should be emitted
      expect(mockWarning).not.toHaveBeenCalled()
    })

    it('should succeed when action.yml has no schema file', async () => {
      const actionYml = `
name: Test Action
inputs:
  input-1:
    description: Input 1
    required: true
outputs:
  output-1:
    description: Output 1
`

      const actionPath = path.join(testDir, 'action.yml')

      await fs.writeFile(actionPath, actionYml)

      const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

      // Verify the schema was loaded successfully
      expect(schema.inputs.size).toBe(1)
      expect(schema.outputs.size).toBe(1)

      // No warnings should be emitted
      expect(mockWarning).not.toHaveBeenCalled()
    })

    it('should succeed when both action.yml and schema have no inputs/outputs', async () => {
      const actionYml = `
name: Test Action
description: A test action
`
      const schemaYml = `
# Empty schema
`

      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, actionYml)
      await fs.writeFile(schemaPath, schemaYml)

      const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

      // Verify the schema was loaded successfully
      expect(schema.inputs.size).toBe(0)
      expect(schema.outputs.size).toBe(0)

      // No warnings should be emitted
      expect(mockWarning).not.toHaveBeenCalled()
    })

    it('should warn when schema has only inputs section and action.yml has undocumented outputs', async () => {
      const actionYml = `
name: Test Action
inputs:
  input-1:
    description: Input 1
    required: true
outputs:
  output-1:
    description: Output 1
`
      const schemaYml = `
inputs:
  input-1:
    type: string
`

      const actionPath = path.join(testDir, 'action.yml')
      const schemaPath = path.join(testDir, 'action.schema.yml')

      await fs.writeFile(actionPath, actionYml)
      await fs.writeFile(schemaPath, schemaYml)

      const schema = await loadActionSchema(actionPath, testDir, 'owner/repo')

      // Verify the schema was loaded successfully
      expect(schema.inputs.size).toBe(1)
      expect(schema.outputs.size).toBe(1)

      // Should warn about undocumented output
      expect(mockWarning).toHaveBeenCalledWith(
        expect.stringContaining("Output 'output-1'"),
        expect.any(Object)
      )
    })
  })
})
