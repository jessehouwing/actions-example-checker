# GitHub Actions Example Checker

[![CI](https://github.com/jessehouwing/actions-example-checker/actions/workflows/ci.yml/badge.svg)](https://github.com/jessehouwing/actions-example-checker/actions/workflows/ci.yml)
[![Linter](https://github.com/jessehouwing/actions-example-checker/actions/workflows/linter.yml/badge.svg)](https://github.com/jessehouwing/actions-example-checker/actions/workflows/linter.yml)

A GitHub Action that validates examples in documentation against your action's schema. Ensures that all usage examples in your README and other documentation files reference valid inputs and outputs as defined in your `action.yml` files.

## Features

- 🔍 **Automatic Action Discovery**: Finds all `action.yml` and `action.yaml` files in your repository
- 📝 **Documentation Validation**: Scans markdown files for YAML code blocks containing action usage examples
- ✅ **Input Validation**: Checks that all inputs used in examples are defined in the action schema
- 🔢 **Type Checking**: Validates input types (boolean, number) when specified
- 🎯 **Value Validation**: Checks that input values match allowed options when specified
- 🚫 **Expression Handling**: Skips validation for values containing GitHub Actions expressions (`${{ ... }}`)
- 📊 **Output Validation**: Ensures referenced outputs exist in the action schema
- 🔀 **Fork Support**: Automatically detects forks and validates examples using either fork or parent repository names
- 🎯 **Precise Error Reporting**: Reports errors with file, line, and column information using GitHub Actions workflow commands

## Usage

### Basic Usage

Add this action to your CI workflow to validate documentation examples:

```yaml
name: Validate Documentation

on:
  pull_request:
  push:
    branches: [main]

jobs:
  validate-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: jessehouwing/actions-example-checker@v1
```

### With Custom Patterns

Customize which files to scan:

```yaml
- uses: jessehouwing/actions-example-checker@v1
  with:
    repository-path: .
    action-pattern: '{**/,}action.{yml,yaml}'
    docs-pattern: '**/*.md'
```

### With Fork Support

If your repository is a fork (e.g., `jessehouwing/azdo-marketplace` forked from `microsoft/azure-devops-extension-tasks`), the action will automatically detect this and allow examples to use either name:

```yaml
- uses: jessehouwing/actions-example-checker@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
```

This allows documentation to reference either:

- `uses: jessehouwing/azdo-marketplace@v1` (fork name)
- `uses: microsoft/azure-devops-extension-tasks@v1` (parent name)

Both will be validated against the same `action.yml` schema from your repository.

## Inputs

| Input             | Description                                                                      | Required | Default                   |
| ----------------- | -------------------------------------------------------------------------------- | -------- | ------------------------- |
| `token`           | GitHub token for API access to check fork relationships (enables fork detection) | No       | `${{ github.token }}`     |
| `repository`      | Repository name in 'owner/repo' format (auto-detected if not provided)           | No       | Auto-detected             |
| `repository-path` | Path to the repository root (defaults to current directory)                      | No       | `.`                       |
| `action-pattern`  | Glob pattern to find action files                                                | No       | `{**/,}action.{yml,yaml}` |
| `docs-pattern`    | Glob pattern to find documentation files                                         | No       | `**/*.md`                 |

## Outputs

| Output          | Description                           |
| --------------- | ------------------------------------- |
| `errors-found`  | Number of validation errors found     |
| `files-checked` | Number of documentation files checked |

## How It Works

1. **Fork Detection** (optional): If a token is provided, checks if the repository is a fork and identifies the parent repository
2. **Action Discovery**: The action scans your repository for all `action.yml` and `action.yaml` files using the specified pattern
3. **Schema Loading**: Each action file is parsed to extract:
   - Input names, types, and allowed values
   - Output names
   - Required/optional status
   - Alternative names (fork and parent repository names)
4. **Documentation Scanning**: Markdown files are scanned for YAML code blocks (marked with ` ```yaml ` or ` ```yml `)
5. **Example Validation**: For each code block containing action usage (identified by `uses: owner/repo@version`):
   - Validates that all `with:` inputs are defined in the action schema
   - Checks input types (boolean, number) when specified
   - Validates input values against allowed options when specified
   - Validates output references (e.g., `steps.my-step.outputs.result`) exist in the action schema
   - Skips validation for expressions containing `${{ ... }}`
6. **Error Reporting**: Reports errors using GitHub Actions workflow commands with file, line, and column information

## Example

Given an `action.yml`:

```yaml
name: My Action
inputs:
  environment:
    description: 'Environment to deploy to. Options: development, staging, production'
    required: true
  debug:
    description: 'Enable debug mode (boolean)'
    required: false
  timeout:
    description: 'Timeout in seconds (number)'
    required: false
outputs:
  deployment-url:
    description: 'URL of the deployment'
```

Valid example in `README.md`:

```yaml
- uses: owner/my-action@v1
  with:
    environment: production
    debug: true
    timeout: 300
```

Invalid example (will be caught):

```yaml
- uses: owner/my-action@v1
  with:
    environment: prod # Error: Not in [development, staging, production]
    debug: yes # Error: Not a boolean (true/false)
    unknown-input: value # Error: Input not defined in action.yml
```

Expressions are allowed and skipped:

```yaml
- uses: owner/my-action@v1
  with:
    environment: ${{ inputs.env }} # OK: Expression
    debug: ${{ github.event.inputs.debug }} # OK: Expression
```

Output validation example:

```yaml
- uses: owner/my-action@v1
  id: deploy
  with:
    environment: production
- run: echo "Deployed to ${{ steps.deploy.outputs.deployment-url }}" # OK: Valid output
- run: echo "${{ steps.deploy.outputs.invalid }}" # Error: Unknown output 'invalid'
```

## Self-Testing

This action validates its own documentation! Here's a valid example:

```yaml
- uses: jessehouwing/actions-example-checker@v1
  with:
    repository: jessehouwing/actions-example-checker
    repository-path: .
    action-pattern: '{**/,}action.{yml,yaml}'
    docs-pattern: '**/*.md'
```

## Type Detection

The action detects input types from:

1. **Explicit type field**: `type: boolean` or `type: number` in action.yml
2. **Description hints**: Keywords like "boolean" or "number" in the input description
3. **Options/choices**: Extracts allowed values from descriptions like "Options: dev, prod"

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
