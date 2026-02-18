import { describe, expect, it } from '@jest/globals'
import {
  extractYamlCodeBlocks,
  findReferencedSteps,
  validateStep,
  validateOutputReferences,
} from '../src/validator.js'
import { ActionSchema } from '../src/index.js'

describe('extractYamlCodeBlocks', () => {
  it('should extract YAML code blocks from markdown', () => {
    const markdown = `
# Title

Some text

\`\`\`yaml
key: value
\`\`\`

More text

\`\`\`yml
another: block
\`\`\`
`
    const blocks = extractYamlCodeBlocks(markdown)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].text).toContain('key: value')
    expect(blocks[1].text).toContain('another: block')
  })

  it('should handle markdown without YAML blocks', () => {
    const markdown = '# Title\n\nNo code blocks here'
    const blocks = extractYamlCodeBlocks(markdown)
    expect(blocks).toHaveLength(0)
  })

  it('should handle empty markdown', () => {
    const blocks = extractYamlCodeBlocks('')
    expect(blocks).toHaveLength(0)
  })

  it('should calculate correct line numbers', () => {
    const markdown = `Line 1
Line 2
\`\`\`yaml
content
\`\`\`
`
    const blocks = extractYamlCodeBlocks(markdown)
    expect(blocks[0].contentStartLine).toBe(4)
  })
})

describe('findReferencedSteps', () => {
  const createSchema = (repo: string): ActionSchema => ({
    actionReference: repo,
    alternativeNames: [],
    inputs: new Map(),
    outputs: new Set(),
    sourceFile: 'action.yml',
    descriptions: [],
  })

  it('should find referenced steps in valid YAML', () => {
    const yaml = `
steps:
  - uses: owner/repo@v1
    with:
      input1: value1
`
    const schemas = new Map([['owner/repo', createSchema('owner/repo')]])
    const steps = findReferencedSteps(yaml, schemas)

    expect(steps).toHaveLength(1)
    expect(steps[0].actionReference).toBe('owner/repo')
    expect(steps[0].uses).toBe('owner/repo@v1')
  })

  it('should find multiple steps', () => {
    const yaml = `
steps:
  - uses: owner/repo1@v1
  - uses: owner/repo2@v2
`
    const schemas = new Map([
      ['owner/repo1', createSchema('owner/repo1')],
      ['owner/repo2', createSchema('owner/repo2')],
    ])
    const steps = findReferencedSteps(yaml, schemas)

    expect(steps).toHaveLength(2)
  })

  it('should handle invalid YAML with tolerant mode', () => {
    const yaml = `
- uses: owner/repo@v1
  with:
    input1: value1
    # Missing colon on next line would break strict YAML
`
    const schemas = new Map([['owner/repo', createSchema('owner/repo')]])
    const steps = findReferencedSteps(yaml, schemas)

    expect(steps).toHaveLength(1)
  })

  it('should extract with inputs', () => {
    const yaml = `
- uses: owner/repo@v1
  with:
    input1: value1
    input2: value2
`
    const schemas = new Map([['owner/repo', createSchema('owner/repo')]])
    const steps = findReferencedSteps(yaml, schemas)

    expect(steps[0].with).toBeDefined()
    expect(steps[0].with?.input1).toBe('value1')
    expect(steps[0].with?.input2).toBe('value2')
  })

  it('should extract step id', () => {
    const yaml = `
- uses: owner/repo@v1
  id: my-step
`
    const schemas = new Map([['owner/repo', createSchema('owner/repo')]])
    const steps = findReferencedSteps(yaml, schemas)

    expect(steps[0].id).toBe('my-step')
  })

  it('should not find non-matching actions', () => {
    const yaml = `
- uses: other/action@v1
`
    const schemas = new Map([['owner/repo', createSchema('owner/repo')]])
    const steps = findReferencedSteps(yaml, schemas)

    expect(steps).toHaveLength(0)
  })
})

describe('validateStep', () => {
  it('should report unknown inputs', () => {
    const schema: ActionSchema = {
      actionReference: 'owner/repo',
      alternativeNames: [],
      inputs: new Map([['valid-input', { required: true }]]),
      outputs: new Set(),
      sourceFile: 'action.yml',
      descriptions: [],
    }

    const step = {
      actionReference: 'owner/repo',
      uses: 'owner/repo@v1',
      with: {
        'valid-input': 'value',
        'unknown-input': 'value',
      },
      lineInBlock: 1,
    }

    const errors = validateStep(step, schema, 1)

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('unknown-input')
  })

  it('should validate boolean types', () => {
    const schema: ActionSchema = {
      actionReference: 'owner/repo',
      alternativeNames: [],
      inputs: new Map([['debug', { required: false, type: 'boolean' }]]),
      outputs: new Set(),
      sourceFile: 'action.yml',
      descriptions: [],
    }

    const step = {
      actionReference: 'owner/repo',
      uses: 'owner/repo@v1',
      with: {
        debug: 'yes',
      },
      lineInBlock: 1,
    }

    const errors = validateStep(step, schema, 1)

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('boolean')
  })

  it('should accept valid boolean values', () => {
    const schema: ActionSchema = {
      actionReference: 'owner/repo',
      alternativeNames: [],
      inputs: new Map([['debug', { required: false, type: 'boolean' }]]),
      outputs: new Set(),
      sourceFile: 'action.yml',
      descriptions: [],
    }

    const step = {
      actionReference: 'owner/repo',
      uses: 'owner/repo@v1',
      with: {
        debug: 'true',
      },
      lineInBlock: 1,
    }

    const errors = validateStep(step, schema, 1)

    expect(errors).toHaveLength(0)
  })

  it('should validate number types', () => {
    const schema: ActionSchema = {
      actionReference: 'owner/repo',
      alternativeNames: [],
      inputs: new Map([['timeout', { required: false, type: 'number' }]]),
      outputs: new Set(),
      sourceFile: 'action.yml',
      descriptions: [],
    }

    const step = {
      actionReference: 'owner/repo',
      uses: 'owner/repo@v1',
      with: {
        timeout: 'not-a-number',
      },
      lineInBlock: 1,
    }

    const errors = validateStep(step, schema, 1)

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('number')
  })

  it('should accept valid number values', () => {
    const schema: ActionSchema = {
      actionReference: 'owner/repo',
      alternativeNames: [],
      inputs: new Map([['timeout', { required: false, type: 'number' }]]),
      outputs: new Set(),
      sourceFile: 'action.yml',
      descriptions: [],
    }

    const step = {
      actionReference: 'owner/repo',
      uses: 'owner/repo@v1',
      with: {
        timeout: '300',
      },
      lineInBlock: 1,
    }

    const errors = validateStep(step, schema, 1)

    expect(errors).toHaveLength(0)
  })

  it('should validate input options', () => {
    const schema: ActionSchema = {
      actionReference: 'owner/repo',
      alternativeNames: [],
      inputs: new Map([
        [
          'environment',
          {
            required: true,
            options: ['development', 'staging', 'production'],
          },
        ],
      ]),
      outputs: new Set(),
      sourceFile: 'action.yml',
      descriptions: [],
    }

    const step = {
      actionReference: 'owner/repo',
      uses: 'owner/repo@v1',
      with: {
        environment: 'prod',
      },
      lineInBlock: 1,
    }

    const errors = validateStep(step, schema, 1)

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('development, staging, production')
  })

  it('should accept valid option values', () => {
    const schema: ActionSchema = {
      actionReference: 'owner/repo',
      alternativeNames: [],
      inputs: new Map([
        [
          'environment',
          {
            required: true,
            options: ['development', 'staging', 'production'],
          },
        ],
      ]),
      outputs: new Set(),
      sourceFile: 'action.yml',
      descriptions: [],
    }

    const step = {
      actionReference: 'owner/repo',
      uses: 'owner/repo@v1',
      with: {
        environment: 'production',
      },
      lineInBlock: 1,
    }

    const errors = validateStep(step, schema, 1)

    expect(errors).toHaveLength(0)
  })

  it('should skip validation for expressions', () => {
    const schema: ActionSchema = {
      actionReference: 'owner/repo',
      alternativeNames: [],
      inputs: new Map([
        ['debug', { required: false, type: 'boolean' }],
        [
          'environment',
          {
            required: true,
            options: ['development', 'staging', 'production'],
          },
        ],
      ]),
      outputs: new Set(),
      sourceFile: 'action.yml',
      descriptions: [],
    }

    const step = {
      actionReference: 'owner/repo',
      uses: 'owner/repo@v1',
      with: {
        debug: '${{ inputs.debug }}',
        environment: '${{ github.event.inputs.env }}',
      },
      lineInBlock: 1,
    }

    const errors = validateStep(step, schema, 1)

    expect(errors).toHaveLength(0)
  })

  it('should skip validation for partial expressions', () => {
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

    const step = {
      actionReference: 'owner/repo',
      uses: 'owner/repo@v1',
      with: {
        environment: 'prefix-${{ inputs.suffix }}',
      },
      lineInBlock: 1,
    }

    const errors = validateStep(step, schema, 1)

    expect(errors).toHaveLength(0)
  })

  it('should validate multiple errors in one step', () => {
    const schema: ActionSchema = {
      actionReference: 'owner/repo',
      alternativeNames: [],
      inputs: new Map([['debug', { required: false, type: 'boolean' }]]),
      outputs: new Set(),
      sourceFile: 'action.yml',
      descriptions: [],
    }

    const step = {
      actionReference: 'owner/repo',
      uses: 'owner/repo@v1',
      with: {
        debug: 'yes',
        unknown1: 'value1',
        unknown2: 'value2',
      },
      lineInBlock: 1,
    }

    const errors = validateStep(step, schema, 1)

    expect(errors.length).toBeGreaterThanOrEqual(3)
  })

  it('should handle steps with no inputs', () => {
    const schema: ActionSchema = {
      actionReference: 'owner/repo',
      alternativeNames: [],
      inputs: new Map(),
      outputs: new Set(),
      sourceFile: 'action.yml',
      descriptions: [],
    }

    const step = {
      actionReference: 'owner/repo',
      uses: 'owner/repo@v1',
      lineInBlock: 1,
    }

    const errors = validateStep(step, schema, 1)

    expect(errors).toHaveLength(0)
  })
})

describe('validateOutputReferences', () => {
  const createSchema = (outputs: string[]): ActionSchema => ({
    actionReference: 'owner/repo',
    alternativeNames: [],
    alternativeNames: [],
    inputs: new Map(),
    outputs: new Set(outputs),
    sourceFile: 'action.yml',
    descriptions: [],
  })

  it('should validate output references in YAML block', () => {
    const yaml = `
- uses: owner/repo@v1
  id: my-step
- run: echo \${{ steps.my-step.outputs.result }}
`
    const schema = createSchema(['result', 'status'])
    const schemas = new Map([['owner/repo', schema]])
    const steps = findReferencedSteps(yaml, schemas)

    const errors = validateOutputReferences(yaml, steps, schemas, 1)

    expect(errors).toHaveLength(0)
  })

  it('should report unknown output references', () => {
    const yaml = `
- uses: owner/repo@v1
  id: my-step
- run: echo \${{ steps.my-step.outputs.invalid }}
`
    const schema = createSchema(['result', 'status'])
    const schemas = new Map([['owner/repo', schema]])
    const steps = findReferencedSteps(yaml, schemas)

    const errors = validateOutputReferences(yaml, steps, schemas, 1)

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('invalid')
    expect(errors[0].message).toContain('result, status')
  })

  it('should handle multiple output references', () => {
    const yaml = `
- uses: owner/repo@v1
  id: step1
- uses: owner/repo@v1
  id: step2
- run: |
    echo \${{ steps.step1.outputs.result }}
    echo \${{ steps.step2.outputs.status }}
    echo \${{ steps.step1.outputs.invalid }}
`
    const schema = createSchema(['result', 'status'])
    const schemas = new Map([['owner/repo', schema]])
    const steps = findReferencedSteps(yaml, schemas)

    const errors = validateOutputReferences(yaml, steps, schemas, 1)

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('invalid')
  })

  it('should skip validation for steps without IDs', () => {
    const yaml = `
- uses: owner/repo@v1
- run: echo \${{ steps.unknown.outputs.result }}
`
    const schema = createSchema(['result'])
    const schemas = new Map([['owner/repo', schema]])
    const steps = findReferencedSteps(yaml, schemas)

    const errors = validateOutputReferences(yaml, steps, schemas, 1)

    expect(errors).toHaveLength(0)
  })

  it('should handle actions with no outputs', () => {
    const yaml = `
- uses: owner/repo@v1
  id: my-step
- run: echo \${{ steps.my-step.outputs.result }}
`
    const schema = createSchema([])
    const schemas = new Map([['owner/repo', schema]])
    const steps = findReferencedSteps(yaml, schemas)

    const errors = validateOutputReferences(yaml, steps, schemas, 1)

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('Available outputs: none')
  })

  it('should report correct line numbers', () => {
    const yaml = `line 1
line 2
- uses: owner/repo@v1
  id: my-step
line 5
- run: echo \${{ steps.my-step.outputs.invalid }}
`
    const schema = createSchema(['result'])
    const schemas = new Map([['owner/repo', schema]])
    const steps = findReferencedSteps(yaml, schemas)

    const errors = validateOutputReferences(yaml, steps, schemas, 10)

    expect(errors).toHaveLength(1)
    expect(errors[0].line).toBe(15) // Line 6 in block + blockStartLine 10 - 1
  })
})
