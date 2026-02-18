import * as core from '@actions/core'
import { getOctokit } from '@actions/github'

/**
 * Detect if a repository is a fork and get its parent repository
 */
export async function detectForkParent(
  repository: string,
  token?: string
): Promise<string | null> {
  if (!token) {
    core.debug('No token provided, skipping fork detection')
    return null
  }

  if (!repository || !repository.includes('/')) {
    core.debug('Invalid repository format, skipping fork detection')
    return null
  }

  try {
    const octokit = getOctokit(token)
    const [owner, repo] = repository.split('/')

    core.debug(`Checking if ${repository} is a fork...`)

    const { data: repoData } = await octokit.rest.repos.get({
      owner,
      repo,
    })

    if (repoData.fork && repoData.parent) {
      const parentName = repoData.parent.full_name
      core.info(`Detected fork: ${repository} is forked from ${parentName}`)
      return parentName
    }

    core.debug(`Repository ${repository} is not a fork`)
    return null
  } catch (error) {
    core.warning(
      `Failed to check fork status for ${repository}: ${error instanceof Error ? error.message : String(error)}`
    )
    return null
  }
}
