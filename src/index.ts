import * as core from '@actions/core'
import { promises as fs } from 'node:fs'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { findActionFiles } from './action-finder.js'
import { loadActionSchema } from './action-schema.js'
import { findMarkdownFiles } from './markdown-finder.js'
import { detectForkParent } from './fork-detector.js'
import {
  extractYamlCodeBlocks,
  findReferencedSteps,
  validateStep,
  validateOutputReferences,
} from './validator.js'

const execAsync = promisify(exec)

/**
 * Detect repository name from git remote
 */
async function detectRepositoryName(): Promise<string> {
  try {
    const { stdout } = await execAsync('git remote get-url origin')
    const remoteUrl = stdout.trim()

    // Parse GitHub URL patterns:
    // - https://github.com/owner/repo.git
    // - git@github.com:owner/repo.git
    const match = remoteUrl.match(
      /github\.com[/:]([\w-]+)\/([\w-]+?)(?:\.git)?$/
    )
    if (match) {
      return `${match[1]}/${match[2]}`
    }
  } catch {
    // Ignore errors
  }
  return ''
}

/**
 * Main runner function
 */
export async function run(): Promise<void> {
  const token = core.getInput('token') || process.env.GITHUB_TOKEN || ''
  let repository =
    core.getInput('repository') || process.env.GITHUB_REPOSITORY || ''

  // If no repository specified, try to detect from git
  if (!repository) {
    repository = await detectRepositoryName()
  }

  const repositoryPath = core.getInput('repository-path') || '.'
  const actionPattern =
    core.getInput('action-pattern') || '{**/,}action.{yml,yaml}'
  const docsPattern = core.getInput('docs-pattern') || '**/*.md'

  core.info(`Repository: ${repository}`)
  core.info(`Repository path: ${repositoryPath}`)
  core.info(`Action pattern: ${actionPattern}`)
  core.info(`Docs pattern: ${docsPattern}`)

  // Detect if this is a fork and get parent repository
  const parentRepo = await detectForkParent(repository, token)

  // Find all action files
  const actionFiles = await findActionFiles(repositoryPath, actionPattern)
  core.info(`Found ${actionFiles.length} action file(s)`)

  if (actionFiles.length === 0) {
    core.warning('No action files found')
    return
  }

  // Load action schemas
  const schemas = new Map<string, ActionSchema>()
  for (const actionFile of actionFiles) {
    try {
      const schema = await loadActionSchema(
        actionFile,
        repositoryPath,
        repository,
        parentRepo
      )
      schemas.set(schema.actionReference, schema)

      // Also register alternative names
      for (const altName of schema.alternativeNames) {
        schemas.set(altName, schema)
      }

      core.info(
        `Loaded schema for ${schema.actionReference} from ${actionFile}`
      )
      if (schema.alternativeNames.length > 0) {
        core.info(`  Alternative names: ${schema.alternativeNames.join(', ')}`)
      }
    } catch (error) {
      core.warning(
        `Failed to load action schema from ${actionFile}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  if (schemas.size === 0) {
    core.warning('No valid action schemas loaded')
    return
  }

  let totalErrors = 0
  let filesChecked = 0

  // Validate examples in action.yml descriptions
  for (const [actionRef, schema] of schemas.entries()) {
    // Only validate once per unique schema (not for alternative names)
    if (schema.actionReference !== actionRef) {
      continue
    }

    if (schema.descriptions.length === 0) {
      continue
    }

    core.debug(`Checking examples in ${schema.sourceFile} descriptions`)

    for (const description of schema.descriptions) {
      const blocks = extractYamlCodeBlocks(description)

      for (const block of blocks) {
        const steps = findReferencedSteps(block.text, schemas)

        for (const step of steps) {
          const stepSchema = schemas.get(step.actionReference)
          if (!stepSchema) {
            continue
          }

          const errors = validateStep(step, stepSchema, block.contentStartLine)

          for (const error of errors) {
            totalErrors++
            core.error(error.message, {
              file: schema.sourceFile,
              startLine: error.line,
              startColumn: error.column,
            })
          }
        }

        // Validate output references in the description block
        const outputErrors = validateOutputReferences(
          block.text,
          steps,
          schemas,
          block.contentStartLine
        )
        for (const error of outputErrors) {
          totalErrors++
          core.error(error.message, {
            file: schema.sourceFile,
            startLine: error.line,
            startColumn: error.column,
          })
        }
      }
    }
  }

  // Find all markdown files
  const markdownFiles = await findMarkdownFiles(repositoryPath, docsPattern)
  core.info(`Found ${markdownFiles.length} documentation file(s)`)

  // Validate each markdown file
  for (const markdownFile of markdownFiles) {
    const relativeFilePath = path.relative(repositoryPath, markdownFile)
    try {
      const content = await fs.readFile(markdownFile, 'utf8')
      const blocks = extractYamlCodeBlocks(content)

      if (blocks.length === 0) {
        continue
      }

      filesChecked++
      core.debug(`Checking ${relativeFilePath} (${blocks.length} blocks)`)

      for (const block of blocks) {
        const steps = findReferencedSteps(block.text, schemas)

        for (const step of steps) {
          const schema = schemas.get(step.actionReference)
          if (!schema) {
            continue
          }

          const errors = validateStep(step, schema, block.contentStartLine)

          for (const error of errors) {
            totalErrors++
            core.error(error.message, {
              file: relativeFilePath,
              startLine: error.line,
              startColumn: error.column,
            })
          }
        }

        // Validate output references in the block
        const outputErrors = validateOutputReferences(
          block.text,
          steps,
          schemas,
          block.contentStartLine
        )
        for (const error of outputErrors) {
          totalErrors++
          core.error(error.message, {
            file: relativeFilePath,
            startLine: error.line,
            startColumn: error.column,
          })
        }
      }
    } catch (error) {
      core.warning(
        `Failed to process ${relativeFilePath}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  core.info(`Validation complete: ${totalErrors} error(s) found`)
  core.setOutput('errors-found', totalErrors)
  core.setOutput('files-checked', filesChecked)

  if (totalErrors > 0) {
    core.setFailed(
      `Found ${totalErrors} validation error(s) in ${filesChecked} file(s)`
    )
  }
}

export interface ActionSchema {
  actionReference: string
  alternativeNames: string[] // Alternative names (e.g., parent repo for forks)
  inputs: Map<
    string,
    {
      required: boolean
      type?: string
      options?: string[]
      match?: RegExp // Compiled regex pattern from schema
    }
  >
  outputs: Set<string>
  sourceFile: string
  descriptions: string[] // All descriptions from action and inputs (for example extraction)
}
