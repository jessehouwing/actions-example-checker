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

## Inputs

| Input             | Description                                                 | Required | Default                |
| ----------------- | ----------------------------------------------------------- | -------- | ---------------------- |
| `repository-path` | Path to the repository root (defaults to current directory) | No       | `.`                    |
| `action-pattern`  | Glob pattern to find action files                           | No       | `**/action.{yml,yaml}` |
| `docs-pattern`    | Glob pattern to find documentation files                    | No       | `**/*.md`              |

## Outputs

| Output          | Description                           |
| --------------- | ------------------------------------- |
| `errors-found`  | Number of validation errors found     |
| `files-checked` | Number of documentation files checked |

## How It Works

1. **Action Discovery**: The action scans your repository for all `action.yml` and `action.yaml` files using the specified pattern
2. **Schema Loading**: Each action file is parsed to extract:
   - Input names, types, and allowed values
   - Output names
   - Required/optional status
3. **Documentation Scanning**: Markdown files are scanned for YAML code blocks (marked with ` ```yaml ` or ` ```yml `)
4. **Example Validation**: For each code block containing action usage (identified by `uses: owner/repo@version`):
   - Validates that all `with:` inputs are defined in the action schema
   - Checks input types (boolean, number) when specified
   - Validates input values against allowed options when specified
   - Skips validation for expressions containing `${{ ... }}`
5. **Error Reporting**: Reports errors using GitHub Actions workflow commands with file, line, and column information

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
