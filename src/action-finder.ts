import * as glob from '@actions/glob'
import path from 'node:path'

/**
 * Find all action.yml/action.yaml files in the repository
 */
export async function findActionFiles(
  repositoryPath: string,
  _pattern: string
): Promise<string[]> {
  const patterns = [
    path.join(repositoryPath, 'action.yml'),
    path.join(repositoryPath, 'action.yaml'),
    path.join(repositoryPath, '**/action.yml'),
    path.join(repositoryPath, '**/action.yaml'),
  ]

  const allFiles: string[] = []

  for (const p of patterns) {
    try {
      const globber = await glob.create(p, {
        followSymbolicLinks: false,
      })
      const files = await globber.glob()
      allFiles.push(...files)
    } catch {
      // Ignore errors for patterns that don't match
    }
  }

  // Deduplicate files
  const uniqueFiles = [...new Set(allFiles)]

  // Filter out node_modules and other common directories
  return uniqueFiles.filter((file) => {
    const relativePath = path.relative(repositoryPath, file)
    return (
      !relativePath.includes('node_modules') &&
      !relativePath.includes('.git') &&
      !relativePath.includes('dist') &&
      !relativePath.includes('coverage')
    )
  })
}
