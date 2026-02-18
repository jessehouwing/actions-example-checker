import { promises as fs } from 'node:fs'
import path from 'node:path'
import * as yaml from 'yaml'

/**
 * Base type constants
 */
const BASE_TYPES = ['boolean', 'number', 'string', 'choice', 'any'] as const

/**
 * Convert a value to string for use in alternatives
 * Accepts: string, number, boolean, null, undefined
 * Returns the string representation
 */
function convertToString(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (value === undefined) {
    return 'undefined'
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  // For any other type, convert to string representation
  return String(value)
}

/**
 * Choice option with optional description and alternatives
 */
export interface ChoiceOption {
  value: string
  description?: string
  alternatives?: string[]
}

/**
 * Type definition for custom types and inputs/outputs
 */
export interface TypeDefinition {
  type: string // can be a base type (boolean, number, string, choice, any) or a custom type reference
  match?: string // regex pattern for string type
  options?: (string | ChoiceOption)[] // valid options for choice type - can be simple strings or objects with value, description, and alternatives
  separators?: string | string[] // separator(s) for multi-value inputs (e.g., ',', [',', ';'], 'newline')
  items?: TypeDefinition // validation for each item in multi-value inputs
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
  type: 'boolean' | 'number' | 'string' | 'choice' | 'any'
  match?: RegExp // compiled regex pattern
  options?: string[]
  separators?: string[] // separator(s) for multi-value inputs (normalized to array)
  items?: ResolvedTypeDefinition // validation for each item in multi-value inputs
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

  const result: TypeDefinition = {
    type: type,
  }

  const isBaseType = BASE_TYPES.includes(type as any)

  // Validate match for string type (only enforce for base types)
  if (typeDef.match && typeof typeDef.match === 'string') {
    if (isBaseType && result.type !== 'string') {
      throw new Error(`match can only be used with string type`)
    }
    result.match = typeDef.match
  }

  // Validate options for choice type (only enforce for base types)
  if (typeDef.options) {
    if (isBaseType && result.type !== 'choice') {
      throw new Error(`options can only be used with choice type`)
    }
    if (Array.isArray(typeDef.options)) {
      result.options = typeDef.options.map((opt) => {
        if (typeof opt === 'string') {
          return opt
        } else if (typeof opt === 'object' && opt !== null) {
          // Validate ChoiceOption structure
          const choiceOpt = opt as Record<string, unknown>
          if (typeof choiceOpt.value !== 'string') {
            throw new Error(`Choice option must have a 'value' string property`)
          }
          if (
            choiceOpt.description !== undefined &&
            typeof choiceOpt.description !== 'string'
          ) {
            throw new Error(
              `Choice option 'description' must be a string if provided`
            )
          }
          if (choiceOpt.alternatives !== undefined) {
            // Normalize alternatives to array format
            // Supports: single value (string, number, boolean, null, undefined) or array of such values
            let alternativesArray: string[]
            if (Array.isArray(choiceOpt.alternatives)) {
              // Already an array - convert all elements to strings
              alternativesArray = choiceOpt.alternatives.map((alt) =>
                convertToString(alt)
              )
            } else {
              // Single value - convert to string and wrap in array
              alternativesArray = [convertToString(choiceOpt.alternatives)]
            }

            return {
              value: choiceOpt.value,
              description: choiceOpt.description as string | undefined,
              alternatives: alternativesArray,
            } as ChoiceOption
          }
          return {
            value: choiceOpt.value,
            description: choiceOpt.description as string | undefined,
            alternatives: choiceOpt.alternatives as string[] | undefined,
          } as ChoiceOption
        } else {
          throw new Error(
            `Options must be strings or objects with value, description, and alternatives properties`
          )
        }
      })
    }
  }

  // Ensure choice type has options (only enforce for base types)
  if (
    isBaseType &&
    result.type === 'choice' &&
    (!result.options || result.options.length === 0)
  ) {
    throw new Error(`choice type requires options array`)
  }

  // Validate separators for multi-value inputs
  if (typeDef.separators) {
    if (typeof typeDef.separators === 'string') {
      result.separators = typeDef.separators
    } else if (Array.isArray(typeDef.separators)) {
      result.separators = typeDef.separators.map(String)
    } else {
      throw new Error(
        `separators must be a string or array of strings, got ${typeof typeDef.separators}`
      )
    }
  }

  // Validate items for multi-value inputs
  if (typeDef.items) {
    if (typeof typeDef.items === 'object' && typeDef.items !== null) {
      result.items = validateTypeDefinition(typeDef.items)
    } else {
      throw new Error(`items must be a type definition object`)
    }
  }

  // If items is specified, separators should also be specified (or default to newline)
  if (result.items && !result.separators) {
    result.separators = 'newline' // default separators
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
  let baseTypeDef: TypeDefinition
  let overrides: Partial<TypeDefinition> = {}

  // If it's a string, it's a direct reference to a custom type
  if (typeof def === 'string') {
    const customType = customTypes[def]
    if (!customType) {
      throw new Error(`Unknown custom type: ${def}`)
    }
    baseTypeDef = customType
  } else {
    // Check if def.type is a custom type reference (not a base type)
    if (!BASE_TYPES.includes(def.type as any)) {
      // def.type is a custom type reference
      const customType = customTypes[def.type]
      if (!customType) {
        throw new Error(`Unknown custom type: ${def.type}`)
      }
      // Use the custom type as base, but allow overrides from def
      baseTypeDef = customType
      // Only include properties that are actually defined to avoid explicit undefined values
      if (def.match !== undefined) overrides.match = def.match
      if (def.options !== undefined) overrides.options = def.options
      if (def.separators !== undefined) overrides.separators = def.separators
      if (def.items !== undefined) overrides.items = def.items
    } else {
      // def.type is a base type, use def as-is
      baseTypeDef = def
    }
  }

  // Recursively resolve the base type if it's also a reference
  let resolvedBase: ResolvedTypeDefinition
  if (!BASE_TYPES.includes(baseTypeDef.type as any)) {
    // Base type is also a custom type reference, resolve it recursively
    resolvedBase = resolveTypeDefinition(baseTypeDef.type, customTypes)
  } else {
    // Base type is a base type, start with it
    resolvedBase = {
      type: baseTypeDef.type as
        | 'boolean'
        | 'number'
        | 'string'
        | 'choice'
        | 'any',
    }
  }

  // Apply properties from baseTypeDef (after resolving the base type)
  if (baseTypeDef.match) {
    resolvedBase.match = compileRegex(baseTypeDef.match)
  }

  // Copy options if present, flattening alternatives into the main options array
  if (baseTypeDef.options) {
    resolvedBase.options = []
    for (const opt of baseTypeDef.options) {
      if (typeof opt === 'string') {
        resolvedBase.options.push(opt)
      } else {
        // For object options, add the primary value
        resolvedBase.options.push(opt.value)
        // Add all alternatives as valid values
        if (opt.alternatives) {
          resolvedBase.options.push(...opt.alternatives)
        }
      }
    }
  }

  // Normalize separators to array format
  if (baseTypeDef.separators) {
    if (typeof baseTypeDef.separators === 'string') {
      resolvedBase.separators = [baseTypeDef.separators]
    } else if (Array.isArray(baseTypeDef.separators)) {
      resolvedBase.separators = [...baseTypeDef.separators]
    }
  }

  // Recursively resolve items if present
  if (baseTypeDef.items) {
    resolvedBase.items = resolveTypeDefinition(baseTypeDef.items, customTypes)
  }

  // Apply overrides (from the original def when it had a custom type in its type field)
  if (overrides.match !== undefined) {
    resolvedBase.match = compileRegex(overrides.match)
  }

  if (overrides.options !== undefined) {
    resolvedBase.options = []
    for (const opt of overrides.options) {
      if (typeof opt === 'string') {
        resolvedBase.options.push(opt)
      } else {
        resolvedBase.options.push(opt.value)
        if (opt.alternatives) {
          resolvedBase.options.push(...opt.alternatives)
        }
      }
    }
  }

  // Override separators if specified
  if (overrides.separators !== undefined) {
    if (typeof overrides.separators === 'string') {
      resolvedBase.separators = [overrides.separators]
    } else if (Array.isArray(overrides.separators)) {
      resolvedBase.separators = [...overrides.separators]
    }
  }

  // Override items if specified
  if (overrides.items !== undefined) {
    resolvedBase.items = resolveTypeDefinition(overrides.items, customTypes)
  }

  return resolvedBase
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
