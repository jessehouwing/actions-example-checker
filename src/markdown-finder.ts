import * as glob from '@actions/glob'
import path from 'node:path'

/**
 * Find all markdown files in the repository
 */
export async function findMarkdownFiles(
  repositoryPath: string,
  pattern: string
): Promise<string[]> {
  const globber = await glob.create(path.join(repositoryPath, pattern), {
    followSymbolicLinks: false,
  })

  const files = await globber.glob()

  // Filter out node_modules and other common directories
  return files.filter((file) => {
    const relativePath = path.relative(repositoryPath, file)
    return (
      !relativePath.includes('node_modules') &&
      !relativePath.includes('.git') &&
      !relativePath.includes('dist') &&
      !relativePath.includes('coverage')
    )
  })
}
