/**
 * Normalize a value for validation
 * 
 * This function applies the following transformations:
 * - Remove leading/trailing whitespace
 * - Unindent multiline values
 * - Rejoin folded scalar (>) lines into a single value
 * - Remove enclosing quotes ("..." or '...')
 * - Remove trailing comments (# ...)
 * - Preserve literal expressions as-is
 */
export function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  let str = String(value)

  // Check if the value contains non-literal expressions
  // If it does, return null to skip validation
  if (containsNonLiteralExpression(str)) {
    return null
  }

  // Check if the entire value is a literal expression
  // If so, preserve it as-is (but still remove outer quotes if present)
  if (isLiteralExpression(str)) {
    // Only remove enclosing quotes from the entire expression
    return removeEnclosingQuotes(str.trim())
  }

  // Remove leading and trailing whitespace
  str = str.trim()

  // Remove enclosing quotes
  str = removeEnclosingQuotes(str)

  // Remove trailing comments
  str = removeTrailingComment(str)

  // Unindent multiline values
  str = unindent(str)

  // Re-join lines (for folded scalars, collapse to single line)
  // This is already handled by YAML parser, but we normalize just in case
  // Replace multiple newlines with single space and collapse multiple spaces
  str = str.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()

  return str
}

/**
 * Check if a value is a literal expression (entire value is ${{ ... }} with literal content)
 */
function isLiteralExpression(value: string): boolean {
  const trimmed = value.trim()
  // Check if entire value is an expression
  const fullExpressionMatch = trimmed.match(/^\$\{\{(.*?)\}\}$/)
  if (!fullExpressionMatch) {
    return false
  }
  
  const expression = fullExpressionMatch[1].trim()
  
  // Check if it's a literal
  const isSingleQuoted = /^'(?:[^']|'')*'$/.test(expression)
  const isDoubleQuoted = /^"(?:[^"\\]|\\.)*"$/.test(expression)
  const isNumber = /^-?(?:0x[0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)$/i.test(expression)
  const isBooleanOrNull = /^(true|false|null)$/i.test(expression)
  
  return isSingleQuoted || isDoubleQuoted || isNumber || isBooleanOrNull
}

/**
 * Check if a value contains a GitHub Actions expression
 */
export function containsExpression(value: string): boolean {
  return /\$\{\{.*?\}\}/.test(value)
}

/**
 * Check if a value contains non-literal expressions
 * Returns true if the value contains expressions that are not simple literals
 */
function containsNonLiteralExpression(value: string): boolean {
  // Check for expressions
  const expressionRegex = /\$\{\{(.*?)\}\}/g
  let match
  
  while ((match = expressionRegex.exec(value)) !== null) {
    const expression = match[1].trim()
    
    // Check if it's a literal expression
    // Literals include: strings ('...' or "..."), numbers (including negative, hex, exponential), booleans (true/false), null
    
    // Match single-quoted strings with escaped quotes support ('It''s open source!' where '' escapes to ')
    const isSingleQuoted = /^'(?:[^']|'')*'$/.test(expression)
    
    // Match double-quoted strings with escaped quotes support
    const isDoubleQuoted = /^"(?:[^"\\]|\\.)*"$/.test(expression)
    
    // Match numbers: supports negative, decimal, hex (0x/0X), and exponential notation
    // Examples: 711, -9.2, 0xff, -2.99e-2, 1.5e10
    const isNumber = /^-?(?:0x[0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)$/i.test(expression)
    
    // Match booleans and null
    const isBooleanOrNull = /^(true|false|null)$/i.test(expression)
    
    const isLiteral = isSingleQuoted || isDoubleQuoted || isNumber || isBooleanOrNull
    
    if (!isLiteral) {
      // Non-literal expression found
      return true
    }
  }

  return false
}

/**
 * Remove enclosing quotes from a string
 */
function removeEnclosingQuotes(str: string): string {
  // Remove double quotes
  if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
    return str.slice(1, -1)
  }
  
  // Remove single quotes
  if (str.startsWith("'") && str.endsWith("'") && str.length >= 2) {
    return str.slice(1, -1)
  }
  
  return str
}

/**
 * Remove trailing comment from a value
 * Handles: "value # this is a comment" -> "value"
 */
function removeTrailingComment(str: string): string {
  // Only remove comments that are preceded by whitespace
  const commentMatch = str.match(/^(.*?)\s+#.*$/)
  if (commentMatch) {
    return commentMatch[1].trim()
  }
  return str
}

/**
 * Unindent a multiline string
 */
function unindent(str: string): string {
  const lines = str.split('\n')
  
  // Find minimum indentation (ignoring empty lines)
  let minIndent = Infinity
  for (const line of lines) {
    if (line.trim().length === 0) {
      continue
    }
    const indent = line.match(/^\s*/)?.[0].length || 0
    minIndent = Math.min(minIndent, indent)
  }

  // If no content lines found, return as-is
  if (minIndent === Infinity) {
    return str
  }

  // Remove minimum indentation from all lines
  return lines
    .map(line => {
      if (line.trim().length === 0) {
        return ''
      }
      return line.slice(minIndent)
    })
    .join('\n')
}

/**
 * Normalize a boolean value
 * Supports truthy and falsy values from GitHub Actions
 */
export function normalizeBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) {
    return null
  }

  // If already a boolean, return it
  if (typeof value === 'boolean') {
    return value
  }

  const str = normalizeValue(value)
  if (str === null) {
    return null
  }

  const lower = str.toLowerCase()

  // Truthy values
  if (['true', 'yes', 'y', '1', 'on'].includes(lower)) {
    return true
  }

  // Falsy values
  if (['false', 'no', 'n', '0', 'off', ''].includes(lower)) {
    return false
  }

  return null
}

/**
 * Normalize a number value
 * Supports JSON number notations and coercions
 */
export function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }

  // If already a number, return it
  if (typeof value === 'number') {
    return value
  }

  const str = normalizeValue(value)
  if (str === null) {
    return null
  }

  // Try to parse as number
  const num = Number(str)
  if (isNaN(num)) {
    return null
  }

  return num
}

/**
 * Validate a value against a regex pattern
 */
export function validateMatch(value: string, pattern: RegExp): boolean {
  return pattern.test(value)
}
