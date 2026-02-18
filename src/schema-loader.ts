import { promises as fs } from 'node:fs'
import path from 'node:path'
import * as yaml from 'yaml'

/**
 * Type definition for custom types and inputs/outputs
 */
export interface TypeDefinition {
  type: 'boolean' | 'number' | 'string' | 'choice'
  match?: string // regex pattern for string type
  options?: string[] // valid options for choice type
}

/**
 * Schema definition for an action
 */
export interface ActionSchemaDefinition {
  types?: Record<string, TypeDefinition>
  inputs?: Record<string, TypeDefinition | string> // can be TypeDefinition or reference to a custom type
  outputs?: Record<string, TypeDefinition | string>
}

/**
 * Resolved type definition (with custom types resolved)
 */
export interface ResolvedTypeDefinition {
  type: 'boolean' | 'number' | 'string' | 'choice'
  match?: RegExp // compiled regex pattern
  options?: string[]
}

/**
 * Load and parse an action.schema.yml file if it exists
 */
export async function loadActionSchemaDefinition(
  actionFilePath: string
): Promise<ActionSchemaDefinition | null> {
  const actionDir = path.dirname(actionFilePath)
  const actionBaseName = path.basename(
    actionFilePath,
    path.extname(actionFilePath)
  )

  // Try both .yml and .yaml extensions
  const schemaFiles = [
    path.join(actionDir, `${actionBaseName}.schema.yml`),
    path.join(actionDir, `${actionBaseName}.schema.yaml`),
  ]

  for (const schemaFile of schemaFiles) {
    try {
      const content = await fs.readFile(schemaFile, 'utf8')
      const schema = yaml.parse(content)

      if (!schema || typeof schema !== 'object') {
        continue
      }

      return validateSchemaDefinition(schema as ActionSchemaDefinition)
    } catch (error) {
      // File doesn't exist or couldn't be parsed, try next
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  return null
}

/**
 * Validate and normalize a schema definition
 */
function validateSchemaDefinition(
  schema: ActionSchemaDefinition
): ActionSchemaDefinition {
  const result: ActionSchemaDefinition = {}

  // Validate types section
  if (schema.types && typeof schema.types === 'object') {
    result.types = {}
    for (const [typeName, typeDef] of Object.entries(schema.types)) {
      if (typeof typeDef === 'object' && typeDef !== null) {
        result.types[typeName] = validateTypeDefinition(typeDef)
      }
    }
  }

  // Validate inputs section
  if (schema.inputs && typeof schema.inputs === 'object') {
    result.inputs = {}
    for (const [inputName, inputDef] of Object.entries(schema.inputs)) {
      if (typeof inputDef === 'string') {
        // Reference to a custom type
        result.inputs[inputName] = inputDef
      } else if (typeof inputDef === 'object' && inputDef !== null) {
        result.inputs[inputName] = validateTypeDefinition(inputDef)
      }
    }
  }

  // Validate outputs section
  if (schema.outputs && typeof schema.outputs === 'object') {
    result.outputs = {}
    for (const [outputName, outputDef] of Object.entries(schema.outputs)) {
      if (typeof outputDef === 'string') {
        // Reference to a custom type
        result.outputs[outputName] = outputDef
      } else if (typeof outputDef === 'object' && outputDef !== null) {
        result.outputs[outputName] = validateTypeDefinition(outputDef)
      }
    }
  }

  return result
}

/**
 * Validate a type definition
 */
function validateTypeDefinition(def: unknown): TypeDefinition {
  const typeDef = def as Record<string, unknown>

  const type = String(typeDef.type || 'string').toLowerCase()
  if (!['boolean', 'number', 'string', 'choice'].includes(type)) {
    throw new Error(
      `Invalid type: ${type}. Must be one of: boolean, number, string, choice`
    )
  }

  const result: TypeDefinition = {
    type: type as 'boolean' | 'number' | 'string' | 'choice',
  }

  // Validate match for string type
  if (typeDef.match && typeof typeDef.match === 'string') {
    if (result.type !== 'string') {
      throw new Error(`match can only be used with string type`)
    }
    result.match = typeDef.match
  }

  // Validate options for choice type
  if (typeDef.options) {
    if (result.type !== 'choice') {
      throw new Error(`options can only be used with choice type`)
    }
    if (Array.isArray(typeDef.options)) {
      result.options = typeDef.options.map(String)
    }
  }

  // Ensure choice type has options
  if (
    result.type === 'choice' &&
    (!result.options || result.options.length === 0)
  ) {
    throw new Error(`choice type requires options array`)
  }

  return result
}

/**
 * Resolve a type definition, handling custom type references
 */
export function resolveTypeDefinition(
  def: TypeDefinition | string,
  customTypes: Record<string, TypeDefinition>
): ResolvedTypeDefinition {
  // If it's a string, it's a reference to a custom type
  if (typeof def === 'string') {
    const customType = customTypes[def]
    if (!customType) {
      throw new Error(`Unknown custom type: ${def}`)
    }
    def = customType
  }

  const resolved: ResolvedTypeDefinition = {
    type: def.type,
  }

  // Compile regex pattern if present
  if (def.match) {
    resolved.match = compileRegex(def.match)
  }

  // Copy options if present
  if (def.options) {
    resolved.options = [...def.options]
  }

  return resolved
}

/**
 * Compile a regex pattern from string notation
 * Supports both "regex" and /regex/flags notation
 */
function compileRegex(pattern: string): RegExp {
  // Check for /regex/flags notation
  const slashMatch = pattern.match(/^\/(.+)\/([gimsuvy]*)$/)
  if (slashMatch) {
    return new RegExp(slashMatch[1], slashMatch[2])
  }

  // Otherwise treat as plain regex string
  return new RegExp(pattern)
}
