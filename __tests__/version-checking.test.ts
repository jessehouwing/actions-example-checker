import { describe, expect, it } from '@jest/globals'
import { validateActionVersion } from '../src/validator.js'
import { parseVersions } from '../src/index.js'
import type { ReferencedStep } from '../src/validator.js'

const makeStep = (uses: string): ReferencedStep => ({
  actionReference: uses.split('@')[0],
  uses,
  lineInBlock: 1,
})

describe('parseVersions', () => {
  it('should return empty array for empty string', () => {
    expect(parseVersions('')).toEqual([])
  })

  it('should parse a single version', () => {
    expect(parseVersions('v1')).toEqual(['v1'])
  })

  it('should parse comma-separated versions', () => {
    expect(parseVersions('v1, v1.2, v1.2.4')).toEqual(['v1', 'v1.2', 'v1.2.4'])
  })

  it('should parse newline-separated versions', () => {
    expect(parseVersions('v1\nv1.2\nv1.2.4')).toEqual(['v1', 'v1.2', 'v1.2.4'])
  })

  it('should parse mixed comma and newline-separated versions', () => {
    expect(parseVersions('v1, v1.2, v1.2.4\nv2, v2.1, v2.1.7')).toEqual([
      'v1',
      'v1.2',
      'v1.2.4',
      'v2',
      'v2.1',
      'v2.1.7',
    ])
  })

  it('should parse multiline block-style versions', () => {
    const input = `v1, v1.2, v1.2.4
v2, v2.1, v2.1.7`
    expect(parseVersions(input)).toEqual([
      'v1',
      'v1.2',
      'v1.2.4',
      'v2',
      'v2.1',
      'v2.1.7',
    ])
  })

  it('should trim whitespace from versions', () => {
    expect(parseVersions('  v1  ,  v2  ')).toEqual(['v1', 'v2'])
  })

  it('should filter out empty entries', () => {
    expect(parseVersions('v1,,v2\n\nv3')).toEqual(['v1', 'v2', 'v3'])
  })
})

describe('validateActionVersion', () => {
  it('should return no errors when allowedVersions is empty', () => {
    const step = makeStep('owner/repo@v1')
    const errors = validateActionVersion(step, [], 1)
    expect(errors).toHaveLength(0)
  })

  it('should return no errors when version matches', () => {
    const step = makeStep('owner/repo@v1')
    const errors = validateActionVersion(step, ['v1'], 1)
    expect(errors).toHaveLength(0)
  })

  it('should return an error when version does not match', () => {
    const step = makeStep('owner/repo@v1')
    const errors = validateActionVersion(step, ['v2'], 1)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("uses version 'v1'")
    expect(errors[0].message).toContain('[v2]')
  })

  it('should return no errors when version is in a list of allowed versions', () => {
    const step = makeStep('owner/repo@v1.2')
    const errors = validateActionVersion(step, ['v1', 'v1.2', 'v1.2.4'], 1)
    expect(errors).toHaveLength(0)
  })

  it('should return an error when version is not in the list', () => {
    const step = makeStep('owner/repo@v0.9')
    const errors = validateActionVersion(
      step,
      ['v1', 'v1.2', 'v1.2.4'],
      1
    )
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("uses version 'v0.9'")
    expect(errors[0].message).toContain('[v1, v1.2, v1.2.4]')
  })

  it('should return no errors when uses has no version (no @ symbol)', () => {
    const step: ReferencedStep = {
      actionReference: 'owner/repo',
      uses: 'owner/repo',
      lineInBlock: 1,
    }
    const errors = validateActionVersion(step, ['v1'], 1)
    expect(errors).toHaveLength(0)
  })

  it('should include the uses string in the error message', () => {
    const step = makeStep('owner/action-name@wrong-ver')
    const errors = validateActionVersion(step, ['v1.2.3'], 1)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('owner/action-name@wrong-ver')
  })

  it('should report correct line numbers', () => {
    const step: ReferencedStep = {
      actionReference: 'owner/repo',
      uses: 'owner/repo@v1',
      lineInBlock: 3,
    }
    const errors = validateActionVersion(step, ['v2'], 10)
    expect(errors).toHaveLength(1)
    // line = blockStartLine + step.lineInBlock - 1 = 10 + 3 - 1 = 12
    expect(errors[0].line).toBe(12)
  })

  it('should handle SHA-style versions', () => {
    const sha = 'abc123def456'
    const step = makeStep(`owner/repo@${sha}`)
    const errors = validateActionVersion(step, [sha], 1)
    expect(errors).toHaveLength(0)
  })

  it('should handle action in subdirectory', () => {
    const step = makeStep('owner/repo/path/to/action@v1')
    const errors = validateActionVersion(step, ['v1'], 1)
    expect(errors).toHaveLength(0)
  })
})
