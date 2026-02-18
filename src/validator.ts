import * as yaml from 'yaml'
import { ActionSchema } from './index.js'

interface YamlBlock {
  text: string
  contentStartLine: number
}

export interface ReferencedStep {
  actionReference: string
  uses: string
  with?: Record<string, unknown>
  withLines?: Map<string, number>
  id?: string
  lineInBlock: number
}

interface ValidationError {
  message: string
  line: number
  column: number
}

/**
 * Extract YAML code blocks from markdown content
 */
export function extractYamlCodeBlocks(markdownContent: string): YamlBlock[] {
  const blocks: YamlBlock[] = []
  const normalized = markdownContent.replace(/\r\n/g, '\n')
  const regex = /```(?:yaml|yml)\s*\n([\s\S]*?)```/gi
  let match

  while ((match = regex.exec(normalized)) !== null) {
    const blockText = match[1]
    const fenceLine = lineAtOffset(normalized, match.index)
    const contentStartLine = fenceLine + 1
    blocks.push({
      text: blockText,
      contentStartLine,
    })
  }

  return blocks
}

/**
 * Find all referenced steps in a YAML block
 */
export function findReferencedSteps(
  blockText: string,
  schemas: Map<string, ActionSchema>
): ReferencedStep[] {
  const steps: ReferencedStep[] = []

  // Try to parse the YAML
  try {
    const parsed = yaml.parse(blockText)
    const foundSteps = findReferencedStepsInObject(parsed, schemas)
    steps.push(...foundSteps)
  } catch {
    // If parsing fails, try tolerant mode
    const foundSteps = findReferencedStepsTolerant(blockText, schemas)
    steps.push(...foundSteps)
  }

  return steps
}

/**
 * Find referenced steps in a parsed YAML object
 */
function findReferencedStepsInObject(
  node: unknown,
  schemas: Map<string, ActionSchema>,
  found: ReferencedStep[] = []
): ReferencedStep[] {
  if (Array.isArray(node)) {
    for (const item of node) {
      findReferencedStepsInObject(item, schemas, found)
    }
    return found
  }

  if (!node || typeof node !== 'object') {
    return found
  }

  const obj = node as Record<string, unknown>

  // Check if this is a step with a 'uses' field
  if (typeof obj.uses === 'string') {
    const actionRef = extractActionReference(obj.uses, schemas)
    if (actionRef) {
      found.push({
        actionReference: actionRef.actionReference,
        uses: obj.uses,
        with:
          obj.with && typeof obj.with === 'object'
            ? (obj.with as Record<string, unknown>)
            : undefined,
        id: typeof obj.id === 'string' ? obj.id : undefined,
        lineInBlock: 1, // We don't have precise line info in strict mode
      })
    }
  }

  // Recursively search nested objects
  for (const value of Object.values(obj)) {
    findReferencedStepsInObject(value, schemas, found)
  }

  return found
}

/**
 * Find referenced steps in YAML text using tolerant parsing
 */
function findReferencedStepsTolerant(
  blockText: string,
  schemas: Map<string, ActionSchema>
): ReferencedStep[] {
  const lines = blockText.split('\n')
  const found: ReferencedStep[] = []

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    const usesMatch = line.match(/^([ \t]*)-?\s*uses:\s*(.+?)\s*$/)
    if (!usesMatch) {
      continue
    }

    const usesValue = unquote(usesMatch[2])
    const actionRef = extractActionReference(usesValue, schemas)
    if (!actionRef) {
      continue
    }

    const stepIndent = usesMatch[1].length
    let id: string | undefined
    let withObject: Record<string, unknown> | undefined
    const withLines = new Map<string, number>()

    let withIndent = -1
    for (
      let innerIndex = lineIndex + 1;
      innerIndex < lines.length;
      innerIndex++
    ) {
      const innerLine = lines[innerIndex]
      if (innerLine.trim().length === 0) {
        continue
      }

      const innerIndent = countIndent(innerLine)
      const nextStepMatch = innerLine.match(/^([ \t]*)-\s+/)
      if (nextStepMatch && nextStepMatch[1].length <= stepIndent) {
        break
      }

      if (innerIndent <= stepIndent) {
        break
      }

      const idMatch = innerLine.match(/^[ \t]*id:\s*([^#\n]+?)\s*$/)
      if (idMatch) {
        id = unquote(idMatch[1])
      }

      const withMatch = innerLine.match(/^([ \t]*)with:\s*$/)
      if (withMatch) {
        withIndent = withMatch[1].length
        withObject = {}
        continue
      }

      if (withIndent >= 0 && innerIndent > withIndent) {
        const keyMatch = innerLine.match(/^[ \t]*([A-Za-z0-9_.-]+)\s*:/)
        if (keyMatch) {
          const key = keyMatch[1]
          withObject = withObject || {}

          // Extract value
          const valueMatch = innerLine.match(/:\s*(.+?)\s*$/)
          if (valueMatch) {
            const rawValue = unquote(valueMatch[1])
            withObject[key] = rawValue
          } else {
            withObject[key] = true
          }

          withLines.set(key, innerIndex + 1)
        }
      }
    }

    found.push({
      actionReference: actionRef.actionReference,
      uses: usesValue,
      with: withObject,
      withLines,
      id,
      lineInBlock: lineIndex + 1,
    })
  }

  return found
}

/**
 * Extract action reference from a uses string
 */
function extractActionReference(
  usesValue: string,
  schemas: Map<string, ActionSchema>
): { actionReference: string } | undefined {
  const trimmed = unquote(usesValue)

  // Check each schema to see if this uses matches
  for (const [actionRef, _schema] of schemas) {
    // Match patterns like:
    // - owner/repo@version (root action)
    // - owner/repo/path@version (action in subdirectory)
    const escapedRef = actionRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`^${escapedRef}@.+$`, 'i')

    if (pattern.test(trimmed)) {
      return { actionReference: actionRef }
    }
  }

  return undefined
}

/**
 * Validate a step against an action schema
 */
export function validateStep(
  step: ReferencedStep,
  schema: ActionSchema,
  blockStartLine: number
): ValidationError[] {
  const errors: ValidationError[] = []

  // Validate inputs
  if (step.with) {
    for (const [inputName, inputValue] of Object.entries(step.with)) {
      const inputSchema = schema.inputs.get(inputName)

      if (!inputSchema) {
        const line =
          step.withLines?.get(inputName) || blockStartLine + step.lineInBlock
        errors.push({
          message: `Unknown input '${inputName}' for action '${step.uses}' (schema: ${schema.sourceFile})`,
          line,
          column: 1,
        })
        continue
      }

      // Skip validation for expressions
      const valueStr = String(inputValue)
      if (containsExpression(valueStr)) {
        continue
      }

      // Validate input type
      if (inputSchema.type && typeof inputValue === 'string') {
        if (inputSchema.type === 'boolean') {
          if (!['true', 'false'].includes(valueStr.toLowerCase())) {
            const line =
              step.withLines?.get(inputName) ||
              blockStartLine + step.lineInBlock
            errors.push({
              message: `Input '${inputName}' for action '${step.uses}' expects a boolean value, but got '${valueStr}'`,
              line,
              column: 1,
            })
          }
        } else if (inputSchema.type === 'number') {
          if (isNaN(Number(valueStr))) {
            const line =
              step.withLines?.get(inputName) ||
              blockStartLine + step.lineInBlock
            errors.push({
              message: `Input '${inputName}' for action '${step.uses}' expects a number value, but got '${valueStr}'`,
              line,
              column: 1,
            })
          }
        }
      }

      // Validate input options
      if (inputSchema.options && inputSchema.options.length > 0) {
        const valueStr = String(inputValue)
        if (
          !containsExpression(valueStr) &&
          !inputSchema.options.includes(valueStr)
        ) {
          const line =
            step.withLines?.get(inputName) || blockStartLine + step.lineInBlock
          errors.push({
            message: `Input '${inputName}' for action '${step.uses}' expects one of [${inputSchema.options.join(', ')}], but got '${valueStr}'`,
            line,
            column: 1,
          })
        }
      }
    }
  }

  // Validate outputs (now handled separately by validateOutputReferences)

  return errors
}

/**
 * Validate output references in a YAML block
 */
export function validateOutputReferences(
  blockText: string,
  steps: ReferencedStep[],
  schemas: Map<string, ActionSchema>,
  blockStartLine: number
): ValidationError[] {
  const errors: ValidationError[] = []

  // Build a map of step IDs to their schemas
  const stepOutputs = new Map<string, Set<string>>()
  for (const step of steps) {
    if (step.id) {
      const schema = schemas.get(step.actionReference)
      if (schema) {
        stepOutputs.set(step.id, schema.outputs)
      }
    }
  }

  // Find all output references in the block: steps.<step-id>.outputs.<output-name>
  const outputRefRegex = /steps\.([A-Za-z0-9_-]+)\.outputs\.([A-Za-z0-9_-]+)/g
  let match

  while ((match = outputRefRegex.exec(blockText)) !== null) {
    const stepId = match[1]
    const outputName = match[2]
    const line = blockStartLine + lineAtOffset(blockText, match.index) - 1

    // Check if the step ID exists
    const outputs = stepOutputs.get(stepId)
    if (!outputs) {
      // Step not found or doesn't have outputs - skip
      continue
    }

    // Check if the output exists in the schema
    if (!outputs.has(outputName)) {
      errors.push({
        message: `Unknown output '${outputName}' for step '${stepId}'. Available outputs: ${outputs.size > 0 ? Array.from(outputs).join(', ') : 'none'}`,
        line,
        column: 1,
      })
    }
  }

  return errors
}

/**
 * Check if a value contains a GitHub Actions expression
 */
function containsExpression(value: string): boolean {
  return /\$\{\{.*?\}\}/.test(value)
}

/**
 * Remove quotes from a string
 */
function unquote(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

/**
 * Count leading whitespace
 */
function countIndent(line: string): number {
  const match = line.match(/^[ \t]*/)
  return match ? match[0].length : 0
}

/**
 * Get line number at a specific offset in text
 */
function lineAtOffset(text: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++
    }
  }
  return line
}
