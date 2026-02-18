import * as core from '@actions/core'
import { promises as fs } from 'node:fs'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { findActionFiles } from './action-finder.js'
import { loadActionSchema } from './action-schema.js'
import { findMarkdownFiles } from './markdown-finder.js'
import {
  extractYamlCodeBlocks,
  findReferencedSteps,
  validateStep,
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
        repository
      )
      schemas.set(schema.actionReference, schema)
      core.info(
        `Loaded schema for ${schema.actionReference} from ${actionFile}`
      )
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

  // Find all markdown files
  const markdownFiles = await findMarkdownFiles(repositoryPath, docsPattern)
  core.info(`Found ${markdownFiles.length} documentation file(s)`)

  let totalErrors = 0
  let filesChecked = 0

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
  inputs: Map<
    string,
    {
      required: boolean
      type?: string
      options?: string[]
    }
  >
  outputs: Set<string>
  sourceFile: string
}
