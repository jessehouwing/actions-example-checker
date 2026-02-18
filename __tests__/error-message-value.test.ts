import { describe, it, expect } from '@jest/globals'
import { findReferencedSteps, validateStep } from '../src/validator.js'
import { ActionSchema } from '../src/index.js'

describe('Pattern validation error message', () => {
  it('should include the actual value in the error message for pattern mismatch', () => {
    const schema: ActionSchema = {
      actionReference: 'test-owner/test-repo',
      alternativeNames: [],
      inputs: new Map([
        [
          'test-input',
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
    test-input: invalid-value
`

    const schemas = new Map([['test-owner/test-repo', schema]])
    const steps = findReferencedSteps(yaml, schemas)
    const errors = validateStep(steps[0], schema, 1)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toContain('invalid-value')
    expect(errors[0].message).toContain('does not match required pattern')
    expect(errors[0].message).toContain("has value 'invalid-value' which")
  })
})
