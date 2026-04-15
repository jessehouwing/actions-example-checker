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

  it('should parse space-separated versions (YAML plain scalar collapses newlines to spaces)', () => {
    // YAML plain scalars collapse newlines to spaces, e.g.:
    //   version: v0, v0.0
    //     ${{ steps.version.outputs.tag }}
    // becomes "v0, v0.0 v0.0.7" after template substitution
    expect(parseVersions('v0, v0.0 v0.0.7')).toEqual(['v0', 'v0.0', 'v0.0.7'])
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
    const errors = validateActionVersion(step, ['v1', 'v1.2', 'v1.2.4'], 1)
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

  it('should not match v1.2 when version is v1.2.4 (no prefix matching)', () => {
    const step = makeStep('owner/repo@v1.2.4')
    const errors = validateActionVersion(step, ['v1.2'], 1)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("uses version 'v1.2.4'")
  })

  it('should not match v1 when version is v1.2.4 (no prefix matching)', () => {
    const step = makeStep('owner/repo@v1.2.4')
    const errors = validateActionVersion(step, ['v1'], 1)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("uses version 'v1.2.4'")
  })

  it('should not match v1.2.4 when version is v1.2 (no prefix matching in reverse)', () => {
    const step = makeStep('owner/repo@v1.2')
    const errors = validateActionVersion(step, ['v1.2.4'], 1)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("uses version 'v1.2'")
  })

  it('should pass when all of major, minor, and patch are in the allowed list', () => {
    const step = makeStep('owner/repo@v1.2.4')
    const errors = validateActionVersion(step, ['v1', 'v1.2', 'v1.2.4'], 1)
    expect(errors).toHaveLength(0)
  })

  it('should pass when only the exact patch version is in the allowed list', () => {
    const step = makeStep('owner/repo@v1.2.4')
    const errors = validateActionVersion(step, ['v1.2.4'], 1)
    expect(errors).toHaveLength(0)
  })
})
