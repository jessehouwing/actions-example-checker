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
  const inputs = new Map<string, { required: boolean }>()
  if (action.inputs && typeof action.inputs === 'object') {
    for (const [inputName, inputDef] of Object.entries(action.inputs)) {
      if (inputDef && typeof inputDef === 'object') {
        const def = inputDef as Record<string, unknown>

        // Parse description for example extraction
        const description =
          typeof def.description === 'string' ? def.description : ''

        // Collect description for example extraction
        if (description) {
          descriptions.push(description)
        }

        inputs.set(inputName, {
          required: def.required === true || def.required === 'true',
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
