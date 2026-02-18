import { describe, expect, it } from '@jest/globals'
import {
  extractYamlCodeBlocks,
  findReferencedSteps,
  validateStep,
} from '../src/validator.js'
import { ActionSchema } from '../src/index.js'

describe('Comment and Syntax Handling', () => {
  const createSchema = (inputs: string[]): ActionSchema => ({
    actionReference: 'owner/repo',
    alternativeNames: [],
    inputs: new Map(inputs.map((name) => [name, { required: false }])),
    outputs: new Set(),
    sourceFile: 'action.yml',
    descriptions: [],
  })

  describe('Trailing Comments', () => {
    it('should handle trailing comments on input values', () => {
      const yaml = `
- uses: owner/repo@v1
  with:
    input1: value1 # this is a comment
    input2: value2 # another comment
`
      const schema = createSchema(['input1', 'input2'])
      const schemas = new Map([['owner/repo', schema]])
      const steps = findReferencedSteps(yaml, schemas)

      expect(steps).toHaveLength(1)
      expect(steps[0].with).toBeDefined()
      expect(steps[0].with?.input1).toBe('value1')
      expect(steps[0].with?.input2).toBe('value2')
    })

    it('should handle comments with special characters', () => {
      const yaml = `
- uses: owner/repo@v1
  with:
    token: ghp_secret123 # GitHub token (keep secure!)
    count: 42 # number of retries
`
      const schema = createSchema(['token', 'count'])
      const schemas = new Map([['owner/repo', schema]])
      const steps = findReferencedSteps(yaml, schemas)

      expect(steps[0].with?.token).toBe('ghp_secret123')
      expect(steps[0].with?.count).toBe(42) // Numeric value, not string
    })

    it('should handle hash symbols in quoted values', () => {
      const yaml = `
- uses: owner/repo@v1
  with:
    message: "value with # hash"
    tag: 'v1.0.0-#123'
`
      const schema = createSchema(['message', 'tag'])
      const schemas = new Map([['owner/repo', schema]])
      const steps = findReferencedSteps(yaml, schemas)

      expect(steps[0].with?.message).toBe('value with # hash')
      expect(steps[0].with?.tag).toBe('v1.0.0-#123')
    })

    it('should handle comments on id field', () => {
      const yaml = `
- uses: owner/repo@v1
  id: my-step # step identifier
  with:
    input1: value1
`
      const schema = createSchema(['input1'])
      const schemas = new Map([['owner/repo', schema]])
      const steps = findReferencedSteps(yaml, schemas)

      expect(steps[0].id).toBe('my-step')
    })
  })

  describe('Multi-line Syntax', () => {
    it('should handle -uses on same line', () => {
      const yaml = `
- uses: owner/repo@v1
  with:
    input1: value1
`
      const schema = createSchema(['input1'])
      const schemas = new Map([['owner/repo', schema]])
      const steps = findReferencedSteps(yaml, schemas)

      expect(steps).toHaveLength(1)
      expect(steps[0].uses).toBe('owner/repo@v1')
    })

    it('should handle -uses without space before uses', () => {
      const yaml = `
-uses: owner/repo@v1
  with:
    input1: value1
`
      const schema = createSchema(['input1'])
      const schemas = new Map([['owner/repo', schema]])
      const steps = findReferencedSteps(yaml, schemas)

      expect(steps).toHaveLength(1)
      expect(steps[0].uses).toBe('owner/repo@v1')
    })

    it('should handle dash with multiple spaces', () => {
      const yaml = `
-    uses: owner/repo@v1
     with:
       input1: value1
`
      const schema = createSchema(['input1'])
      const schemas = new Map([['owner/repo', schema]])
      const steps = findReferencedSteps(yaml, schemas)

      expect(steps).toHaveLength(1)
      expect(steps[0].with?.input1).toBe('value1')
    })

    it('should handle uses without dash', () => {
      const yaml = `
uses: owner/repo@v1
with:
  input1: value1
`
      const schema = createSchema(['input1'])
      const schemas = new Map([['owner/repo', schema]])
      const steps = findReferencedSteps(yaml, schemas)

      expect(steps).toHaveLength(1)
      expect(steps[0].uses).toBe('owner/repo@v1')
    })
  })

  describe('Combined Cases', () => {
    it('should handle multi-line values with pipe', () => {
      const yaml = `
- uses: owner/repo@v1
  with:
    script: |
      echo "line 1"
      echo "line 2"
      echo "line 3"
    other: value
`
      const schema = createSchema(['script', 'other'])
      const schemas = new Map([['owner/repo', schema]])
      const steps = findReferencedSteps(yaml, schemas)

      expect(steps).toHaveLength(1)
      const scriptValue = steps[0].with?.script as string
      expect(scriptValue).toContain('echo "line 1"')
      expect(scriptValue).toContain('echo "line 2"')
      expect(scriptValue).toContain('echo "line 3"')
      // Note: YAML | operator includes trailing newline, so we have 4 elements
      const lines = scriptValue.split('\n')
      expect(lines.length).toBeGreaterThanOrEqual(3)
      expect(lines[0]).toBe('echo "line 1"')
      expect(lines[1]).toBe('echo "line 2"')
      expect(lines[2]).toBe('echo "line 3"')
    })

    it('should handle multi-line values with greater-than', () => {
      const yaml = `
- uses: owner/repo@v1
  with:
    description: >
      This is a long
      description that spans
      multiple lines
`
      const schema = createSchema(['description'])
      const schemas = new Map([['owner/repo', schema]])
      const steps = findReferencedSteps(yaml, schemas)

      expect(steps).toHaveLength(1)
      expect(steps[0].with?.description).toContain('This is a long')
    })

    it('should handle -uses with comments', () => {
      const yaml = `
-uses: owner/repo@v1 # use this action
  id: my-action # step id
  with:
    input1: value1 # first input
    input2: value2 # second input
`
      const schema = createSchema(['input1', 'input2'])
      const schemas = new Map([['owner/repo', schema]])
      const steps = findReferencedSteps(yaml, schemas)

      expect(steps).toHaveLength(1)
      expect(steps[0].uses).toBe('owner/repo@v1')
      expect(steps[0].id).toBe('my-action')
      expect(steps[0].with?.input1).toBe('value1')
      expect(steps[0].with?.input2).toBe('value2')
    })

    it('should validate with comments present', () => {
      const schema: ActionSchema = {
        actionReference: 'owner/repo',
        alternativeNames: [],
        inputs: new Map([
          ['environment', { required: true, options: ['dev', 'prod'] }],
        ]),
        outputs: new Set(),
        sourceFile: 'action.yml',
        descriptions: [],
      }

      const yaml = `
-uses: owner/repo@v1
  with:
    environment: dev # deployment target
`
      const schemas = new Map([['owner/repo', schema]])
      const steps = findReferencedSteps(yaml, schemas)
      const errors = validateStep(steps[0], schema, 1)

      expect(errors).toHaveLength(0)
    })

    // Options validation removed - action.yaml schema doesn't support datatyping
    it.skip('should detect errors even with comments', () => {
      // Test skipped - options validation removed
    })

    // Type validation removed - action.yaml schema doesn't support datatyping
    it.skip('should validate multi-line boolean values', () => {
      // Test skipped - type validation removed
    })

    // Options validation removed - action.yaml schema doesn't support datatyping
    it.skip('should validate multi-line option values', () => {
      // Test skipped - options validation removed
    })

    it('should accept valid multi-line values', () => {
      const schema: ActionSchema = {
        actionReference: 'owner/repo',
        alternativeNames: [],
        inputs: new Map([['script', { required: false }]]),
        outputs: new Set(),
        sourceFile: 'action.yml',
        descriptions: [],
      }

      const yaml = `
- uses: owner/repo@v1
  with:
    script: |
      echo "test"
      echo "script"
`
      const schemas = new Map([['owner/repo', schema]])
      const steps = findReferencedSteps(yaml, schemas)
      const errors = validateStep(steps[0], schema, 1)

      expect(errors).toHaveLength(0)
    })
  })
})
