import { describe, expect, it } from '@jest/globals'
import {
  normalizeValue,
  normalizeBoolean,
  normalizeNumber,
  validateMatch,
  containsExpression,
} from '../src/value-normalizer.js'

describe('normalizeValue', () => {
  it('should trim whitespace', () => {
    expect(normalizeValue('  value  ')).toBe('value')
    expect(normalizeValue('\tvalue\t')).toBe('value')
  })

  it('should remove enclosing double quotes', () => {
    expect(normalizeValue('"value"')).toBe('value')
  })

  it('should remove enclosing single quotes', () => {
    expect(normalizeValue("'value'")).toBe('value')
  })

  it('should remove trailing comments', () => {
    expect(normalizeValue('value # comment')).toBe('value')
    expect(normalizeValue('value  #  comment')).toBe('value')
  })

  it('should not remove # from values without trailing space', () => {
    expect(normalizeValue('value#test')).toBe('value#test')
  })

  it('should handle multiline values', () => {
    const multiline = 'line1\nline2\nline3'
    const normalized = normalizeValue(multiline)
    expect(normalized).toBe('line1 line2 line3')
  })

  it('should unindent values', () => {
    const indented = '  line1\n  line2\n  line3'
    const normalized = normalizeValue(indented)
    expect(normalized).toBe('line1 line2 line3')
  })

  it('should return null for non-literal expressions', () => {
    expect(normalizeValue('${{ secrets.TOKEN }}')).toBeNull()
    expect(normalizeValue('prefix-${{ env.VAR }}')).toBeNull()
    expect(normalizeValue('${{ github.ref }}')).toBeNull()
  })

  it('should handle literal expressions', () => {
    expect(normalizeValue("${{ 'literal' }}")).toBe("${{ 'literal' }}")
    expect(normalizeValue('${{ 123 }}')).toBe('${{ 123 }}')
    expect(normalizeValue('${{ true }}')).toBe('${{ true }}')
    expect(normalizeValue('${{ false }}')).toBe('${{ false }}')
    expect(normalizeValue('${{ null }}')).toBe('${{ null }}')
  })

  it('should handle null and undefined', () => {
    expect(normalizeValue(null)).toBeNull()
    expect(normalizeValue(undefined)).toBeNull()
  })

  it('should handle empty string', () => {
    expect(normalizeValue('')).toBe('')
  })

  it('should handle boolean values', () => {
    expect(normalizeValue(true)).toBe('true')
    expect(normalizeValue(false)).toBe('false')
  })

  it('should handle number values', () => {
    expect(normalizeValue(42)).toBe('42')
    expect(normalizeValue(3.14)).toBe('3.14')
  })
})

describe('containsExpression', () => {
  it('should detect expressions', () => {
    expect(containsExpression('${{ secrets.TOKEN }}')).toBe(true)
    expect(containsExpression('prefix-${{ env.VAR }}-suffix')).toBe(true)
  })

  it('should not detect regular text', () => {
    expect(containsExpression('regular value')).toBe(false)
    expect(containsExpression('no expression here')).toBe(false)
  })

  it('should handle empty strings', () => {
    expect(containsExpression('')).toBe(false)
  })
})

describe('normalizeBoolean', () => {
  it('should accept true boolean', () => {
    expect(normalizeBoolean(true)).toBe(true)
  })

  it('should accept false boolean', () => {
    expect(normalizeBoolean(false)).toBe(false)
  })

  it('should accept truthy strings', () => {
    expect(normalizeBoolean('true')).toBe(true)
    expect(normalizeBoolean('TRUE')).toBe(true)
    expect(normalizeBoolean('True')).toBe(true)
    expect(normalizeBoolean('yes')).toBe(true)
    expect(normalizeBoolean('YES')).toBe(true)
    expect(normalizeBoolean('y')).toBe(true)
    expect(normalizeBoolean('Y')).toBe(true)
    expect(normalizeBoolean('1')).toBe(true)
    expect(normalizeBoolean('on')).toBe(true)
    expect(normalizeBoolean('ON')).toBe(true)
  })

  it('should accept falsy strings', () => {
    expect(normalizeBoolean('false')).toBe(false)
    expect(normalizeBoolean('FALSE')).toBe(false)
    expect(normalizeBoolean('False')).toBe(false)
    expect(normalizeBoolean('no')).toBe(false)
    expect(normalizeBoolean('NO')).toBe(false)
    expect(normalizeBoolean('n')).toBe(false)
    expect(normalizeBoolean('N')).toBe(false)
    expect(normalizeBoolean('0')).toBe(false)
    expect(normalizeBoolean('off')).toBe(false)
    expect(normalizeBoolean('OFF')).toBe(false)
    expect(normalizeBoolean('')).toBe(false)
  })

  it('should return null for non-boolean values', () => {
    expect(normalizeBoolean('maybe')).toBeNull()
    expect(normalizeBoolean('invalid')).toBeNull()
    expect(normalizeBoolean('2')).toBeNull()
  })

  it('should return null for expressions', () => {
    expect(normalizeBoolean('${{ secrets.VALUE }}')).toBeNull()
  })

  it('should handle null and undefined', () => {
    expect(normalizeBoolean(null)).toBeNull()
    expect(normalizeBoolean(undefined)).toBeNull()
  })

  it('should handle values with whitespace', () => {
    expect(normalizeBoolean('  true  ')).toBe(true)
    expect(normalizeBoolean('  false  ')).toBe(false)
  })

  it('should handle values with comments', () => {
    expect(normalizeBoolean('true # comment')).toBe(true)
    expect(normalizeBoolean('false # comment')).toBe(false)
  })

  it('should handle quoted values', () => {
    expect(normalizeBoolean('"true"')).toBe(true)
    expect(normalizeBoolean("'false'")).toBe(false)
  })
})

describe('normalizeNumber', () => {
  it('should accept number values', () => {
    expect(normalizeNumber(42)).toBe(42)
    expect(normalizeNumber(3.14)).toBe(3.14)
    expect(normalizeNumber(0)).toBe(0)
    expect(normalizeNumber(-5)).toBe(-5)
  })

  it('should accept numeric strings', () => {
    expect(normalizeNumber('42')).toBe(42)
    expect(normalizeNumber('3.14')).toBe(3.14)
    expect(normalizeNumber('0')).toBe(0)
    expect(normalizeNumber('-5')).toBe(-5)
  })

  it('should handle scientific notation', () => {
    expect(normalizeNumber('1e3')).toBe(1000)
    expect(normalizeNumber('1.5e2')).toBe(150)
  })

  it('should return null for non-numeric values', () => {
    expect(normalizeNumber('not a number')).toBeNull()
    expect(normalizeNumber('abc')).toBeNull()
  })

  it('should return null for expressions', () => {
    expect(normalizeNumber('${{ env.COUNT }}')).toBeNull()
  })

  it('should handle null and undefined', () => {
    expect(normalizeNumber(null)).toBeNull()
    expect(normalizeNumber(undefined)).toBeNull()
  })

  it('should handle values with whitespace', () => {
    expect(normalizeNumber('  42  ')).toBe(42)
  })

  it('should handle values with comments', () => {
    expect(normalizeNumber('42 # comment')).toBe(42)
  })

  it('should handle quoted values', () => {
    expect(normalizeNumber('"42"')).toBe(42)
    expect(normalizeNumber("'3.14'")).toBe(3.14)
  })
})

describe('validateMatch', () => {
  it('should validate against simple pattern', () => {
    const pattern = /^test$/
    expect(validateMatch('test', pattern)).toBe(true)
    expect(validateMatch('other', pattern)).toBe(false)
  })

  it('should validate against complex pattern', () => {
    const pattern = /^https?:\/\/.+/
    expect(validateMatch('http://example.com', pattern)).toBe(true)
    expect(validateMatch('https://example.com', pattern)).toBe(true)
    expect(validateMatch('ftp://example.com', pattern)).toBe(false)
  })

  it('should support case-insensitive patterns', () => {
    const pattern = /^test$/i
    expect(validateMatch('test', pattern)).toBe(true)
    expect(validateMatch('TEST', pattern)).toBe(true)
    expect(validateMatch('Test', pattern)).toBe(true)
  })

  it('should validate choice patterns', () => {
    const pattern = /^(debug|info|warn|error)$/
    expect(validateMatch('debug', pattern)).toBe(true)
    expect(validateMatch('info', pattern)).toBe(true)
    expect(validateMatch('warn', pattern)).toBe(true)
    expect(validateMatch('error', pattern)).toBe(true)
    expect(validateMatch('other', pattern)).toBe(false)
  })
})
