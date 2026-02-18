import { promises as fs } from 'node:fs'
import path from 'node:path'
import * as yaml from 'yaml'
import { ActionSchema } from './index.js'

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

  // Parse inputs
  const inputs = new Map<
    string,
    { required: boolean; type?: string; options?: string[] }
  >()
  if (action.inputs && typeof action.inputs === 'object') {
    for (const [inputName, inputDef] of Object.entries(action.inputs)) {
      if (inputDef && typeof inputDef === 'object') {
        const def = inputDef as Record<string, unknown>

        // Determine input type from description or type field
        let inputType: string | undefined
        let options: string[] | undefined

        // Check for explicit type
        if (typeof def.type === 'string') {
          inputType = def.type.toLowerCase()
        }

        // Parse description for type hints
        const description =
          typeof def.description === 'string' ? def.description : ''

        // Collect description for example extraction
        if (description) {
          descriptions.push(description)
        }

        if (description.toLowerCase().includes('boolean')) {
          inputType = 'boolean'
        } else if (description.toLowerCase().includes('number')) {
          inputType = 'number'
        }

        // Check for options/enum in description
        const optionsMatch = description.match(
          /(?:options?|choices?|valid values?):\s*([^.]+)/i
        )
        if (optionsMatch) {
          options = optionsMatch[1]
            .split(/[,\s]+/)
            .map((s) => s.trim().replace(/^['"`]|['"`]$/g, ''))
            .filter((s) => s.length > 0)
        }

        inputs.set(inputName, {
          required: def.required === true || def.required === 'true',
          type: inputType,
          options,
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
