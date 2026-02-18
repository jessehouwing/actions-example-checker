import { promises as fs } from 'node:fs'
import path from 'node:path'
import * as yaml from 'yaml'
import { ActionSchema } from './index.js'
import {
  loadActionSchemaDefinition,
  resolveTypeDefinition,
} from './schema-loader.js'

/**
 * Load and parse an action.yml file
 */
export async function loadActionSchema(
  actionFilePath: string,
  repositoryPath: string,
  repository: string,
  parentRepo: string | null = null
): Promise<ActionSchema> {
  const content = await fs.readFile(actionFilePath, 'utf8')
  const action = yaml.parse(content)

  if (!action || typeof action !== 'object') {
    throw new Error('Invalid action.yml format')
  }

  // Determine the action reference based on file location
  const relativeDir = path.dirname(
    path.relative(repositoryPath, actionFilePath)
  )
  const actionPath = relativeDir === '.' ? '' : relativeDir

  // Build full action reference: owner/repo or owner/repo/path
  const actionReference = actionPath
    ? `${repository}/${actionPath}`
    : repository

  // Build alternative names list (for fork parent)
  const alternativeNames: string[] = []
  if (parentRepo) {
    const parentActionReference = actionPath
      ? `${parentRepo}/${actionPath}`
      : parentRepo
    alternativeNames.push(parentActionReference)
  }

  // Collect all descriptions for example extraction
  const descriptions: string[] = []

  // Add root description
  if (action.description && typeof action.description === 'string') {
    descriptions.push(action.description)
  }

  // Load optional schema definition
  const schemaDefinition = await loadActionSchemaDefinition(actionFilePath)

  // Parse inputs
  const inputs = new Map<
    string,
    {
      required: boolean
      type?: string
      options?: string[]
      match?: RegExp
      separators?: string[]
      items?: {
        type?: string
        options?: string[]
        match?: RegExp
      }
    }
  >()
  if (action.inputs && typeof action.inputs === 'object') {
    for (const [inputName, inputDef] of Object.entries(action.inputs)) {
      if (inputDef && typeof inputDef === 'object') {
        const def = inputDef as Record<string, unknown>

        // Determine input type from explicit type field only
        let inputType: string | undefined
        let options: string[] | undefined
        let match: RegExp | undefined
        let separators: string[] | undefined
        let items:
          | {
              type?: string
              options?: string[]
              match?: RegExp
            }
          | undefined

        // Check for explicit type in action.yml
        if (typeof def.type === 'string') {
          inputType = def.type.toLowerCase()
        }

        // Parse description for example extraction only
        const description =
          typeof def.description === 'string' ? def.description : ''

        // Collect description for example extraction
        if (description) {
          descriptions.push(description)
        }

        // Override with schema definition if present
        if (schemaDefinition?.inputs?.[inputName]) {
          const schemaInput = schemaDefinition.inputs[inputName]
          const resolvedType = resolveTypeDefinition(
            schemaInput,
            schemaDefinition.types || {}
          )
          inputType = resolvedType.type
          options = resolvedType.options
          match = resolvedType.match
          separators = resolvedType.separators
          if (resolvedType.items) {
            items = {
              type: resolvedType.items.type,
              options: resolvedType.items.options,
              match: resolvedType.items.match,
            }
          }
        }

        inputs.set(inputName, {
          required: def.required === true || def.required === 'true',
          type: inputType,
          options,
          match,
          separators,
          items,
        })
      }
    }
  }

  // Parse outputs
  const outputs = new Set<string>()
  if (action.outputs && typeof action.outputs === 'object') {
    for (const outputName of Object.keys(action.outputs)) {
      outputs.add(outputName)
    }
  }

  return {
    actionReference,
    alternativeNames,
    inputs,
    outputs,
    sourceFile: path.relative(repositoryPath, actionFilePath),
    descriptions,
  }
}
