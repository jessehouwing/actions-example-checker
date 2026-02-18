import { describe, expect, it, jest, beforeEach } from '@jest/globals'

// Create a mock function that we'll use
const mockGet = jest.fn()

// Mock the getOctokit function
const mockGetOctokit = jest.fn(() => ({
  rest: {
    repos: {
      get: mockGet,
    },
  },
}))

// Mock @actions/github module
jest.unstable_mockModule('@actions/github', () => ({
  getOctokit: mockGetOctokit,
}))

// Import after mocking
const { detectForkParent } = await import('../src/fork-detector.js')

describe('Fork Detection', () => {
  beforeEach(() => {
    mockGet.mockClear()
  })

  it('should detect fork and return parent repository', async () => {
    mockGet.mockResolvedValue({
      data: {
        fork: true,
        parent: {
          full_name: 'microsoft/azure-devops-extension-tasks',
        },
      },
    })

    const parent = await detectForkParent(
      'jessehouwing/azdo-marketplace',
      'fake-token'
    )

    expect(parent).toBe('microsoft/azure-devops-extension-tasks')
    expect(mockGet).toHaveBeenCalledWith({
      owner: 'jessehouwing',
      repo: 'azdo-marketplace',
    })
  })

  it('should return null for non-fork repository', async () => {
    mockGet.mockResolvedValue({
      data: {
        fork: false,
      },
    })

    const parent = await detectForkParent('owner/repo', 'fake-token')

    expect(parent).toBeNull()
  })

  it('should return null when no token provided', async () => {
    const parent = await detectForkParent('owner/repo')

    expect(parent).toBeNull()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('should return null for invalid repository format', async () => {
    const parent = await detectForkParent('invalid', 'fake-token')

    expect(parent).toBeNull()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('should return null on API error', async () => {
    mockGet.mockRejectedValue(new Error('API Error'))

    const parent = await detectForkParent('owner/repo', 'fake-token')

    expect(parent).toBeNull()
  })

  it('should handle fork without parent data', async () => {
    mockGet.mockResolvedValue({
      data: {
        fork: true,
        parent: null,
      },
    })

    const parent = await detectForkParent('owner/repo', 'fake-token')

    expect(parent).toBeNull()
  })
})
