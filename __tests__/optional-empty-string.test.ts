import { describe, it, expect } from '@jest/globals'
import { findReferencedSteps, validateStep } from '../src/validator.js'
import { ActionSchema } from '../src/index.js'

describe('Optional inputs with empty strings', () => {
  it('should accept empty string for optional input with pattern validation', () => {
    const schema: ActionSchema = {
      actionReference: 'test-owner/test-repo',
      alternativeNames: [],
      inputs: new Map([
        [
          'version',
          {
            required: false,
            type: 'string',
            match: /^v?\d+(\.\d+)?(\.\d+)?$/,
          },
        ],
      ]),
      outputs: new Set(),
      sourceFile: 'action.yml',
      descriptions: [],
    }

    const yaml = `
- uses: test-owner/test-repo@v1
  with:
    version: ''
`

    const schemas = new Map([['test-owner/test-repo', schema]])
    const steps = findReferencedSteps(yaml, schemas)
    const errors = validateStep(steps[0], schema, 1)

    expect(errors.length).toBe(0)
  })

  it('should accept empty string (double quotes) for optional input', () => {
    const schema: ActionSchema = {
      actionReference: 'test-owner/test-repo',
      alternativeNames: [],
      inputs: new Map([
        [
          'version',
          {
            required: false,
            type: 'string',
            match: /^v?\d+(\.\d+)?(\.\d+)?$/,
          },
        ],
      ]),
      outputs: new Set(),
      sourceFile: 'action.yml',
      descriptions: [],
    }

    const yaml = `
- uses: test-owner/test-repo@v1
  with:
    version: ""
`

    const schemas = new Map([['test-owner/test-repo', schema]])
    const steps = findReferencedSteps(yaml, schemas)
    const errors = validateStep(steps[0], schema, 1)

    expect(errors.length).toBe(0)
  })

  it('should reject invalid value for optional input when non-empty', () => {
    const schema: ActionSchema = {
      actionReference: 'test-owner/test-repo',
      alternativeNames: [],
      inputs: new Map([
        [
          'version',
          {
            required: false,
            type: 'string',
            match: /^v?\d+(\.\d+)?(\.\d+)?$/,
          },
        ],
      ]),
      outputs: new Set(),
      sourceFile: 'action.yml',
      descriptions: [],
    }

    const yaml = `
- uses: test-owner/test-repo@v1
  with:
    version: 'invalid-value'
`

    const schemas = new Map([['test-owner/test-repo', schema]])
    const steps = findReferencedSteps(yaml, schemas)
    const errors = validateStep(steps[0], schema, 1)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toContain('invalid-value')
    expect(errors[0].message).toContain('does not match required pattern')
  })

  it('should accept empty string for optional multi-value input', () => {
    const schema: ActionSchema = {
      actionReference: 'test-owner/test-repo',
      alternativeNames: [],
      inputs: new Map([
        [
          'tags',
          {
            required: false,
            separators: [','],
            items: {
              type: 'string',
              match: /^v?\d+(\.\d+)?(\.\d+)?$/,
            },
          },
        ],
      ]),
      outputs: new Set(),
      sourceFile: 'action.yml',
      descriptions: [],
    }

    const yaml = `
- uses: test-owner/test-repo@v1
  with:
    tags: ''
`

    const schemas = new Map([['test-owner/test-repo', schema]])
    const steps = findReferencedSteps(yaml, schemas)
    const errors = validateStep(steps[0], schema, 1)

    expect(errors.length).toBe(0)
  })

  it('should reject empty items for required input', () => {
    const schema: ActionSchema = {
      actionReference: 'test-owner/test-repo',
      alternativeNames: [],
      inputs: new Map([
        [
          'version',
          {
            required: true,
            type: 'string',
            match: /^v?\d+(\.\d+)?(\.\d+)?$/,
          },
        ],
      ]),
      outputs: new Set(),
      sourceFile: 'action.yml',
      descriptions: [],
    }

    const yaml = `
- uses: test-owner/test-repo@v1
  with:
    version: ''
`

    const schemas = new Map([['test-owner/test-repo', schema]])
    const steps = findReferencedSteps(yaml, schemas)
    const errors = validateStep(steps[0], schema, 1)

    // Empty string should fail pattern validation for required inputs
    expect(errors.length).toBeGreaterThan(0)
  })
})
