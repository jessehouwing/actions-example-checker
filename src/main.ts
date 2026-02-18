import * as core from '@actions/core'
import { run } from './index.js'

/**
 * Main entry point for the action
 */
async function main(): Promise<void> {
  try {
    await run()
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed('An unexpected error occurred')
    }
  }
}

main()
