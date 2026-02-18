# GitHub Actions Example Checker

[![CI](https://github.com/jessehouwing/actions-example-checker/actions/workflows/ci.yml/badge.svg)](https://github.com/jessehouwing/actions-example-checker/actions/workflows/ci.yml)
[![Linter](https://github.com/jessehouwing/actions-example-checker/actions/workflows/linter.yml/badge.svg)](https://github.com/jessehouwing/actions-example-checker/actions/workflows/linter.yml)

A GitHub Action that validates examples in documentation against your action's schema. Ensures that all usage examples in your README and other documentation files reference valid inputs and outputs as defined in your `action.yml` files.

## Features

- 🔍 **Automatic Action Discovery**: Finds all `action.yml` and `action.yaml` files in your repository
- 📝 **Documentation Validation**: Scans markdown files for YAML code blocks containing action usage examples
- 📋 **Description Examples**: Validates YAML examples embedded in action.yml descriptions (root and input descriptions)
- ✅ **Input Validation**: Checks that all inputs used in examples are defined in the action schema
- 🔢 **Type Checking**: Validates input types (boolean, number, string, choice) when specified
- 🎯 **Value Validation**: Checks that input values match allowed options when specified
- 🔍 **Pattern Matching**: Validates string inputs against regex patterns (via schema file)
- 📐 **Custom Types**: Define reusable types in schema file for consistent validation
- 🚫 **Expression Handling**: Skips validation for values containing GitHub Actions expressions (`${{ ... }}`)
- 📊 **Output Validation**: Ensures referenced outputs exist in the action schema
- 🔀 **Fork Support**: Automatically detects forks and validates examples using either fork or parent repository names
- 💬 **Comment Support**: Handles trailing `#` comments in YAML examples
- 📄 **Multi-line Values**: Supports YAML literal (`|`) and folded (`>`) block scalars
- 🎯 **Precise Error Reporting**: Reports errors with file, line, and column information using GitHub Actions workflow commands
- 📋 **Schema File Support**: Optional `action.schema.yml` for advanced input/output validation

## Usage

<!-- start usage -->

```yaml
- uses: jessehouwing/actions-example-checker@v1
  with:
    # GitHub token for API access to check fork relationships. When provided,
    # the action will detect if the repository is a fork and allow examples to
    # reference either the fork name or the upstream parent name.
    #
    # For example, if your repository jessehouwing/azdo-marketplace is forked
    # from microsoft/azure-devops-extension-tasks, examples can use either:
    # - uses: jessehouwing/azdo-marketplace@v1
    # - uses: microsoft/azure-devops-extension-tasks@v1
    #
    # Both will be validated against the same action.yml schema from your repository.
    #
    # Default: ${{ github.token }}
    token: ''

    # Repository name in 'owner/repo' format. Used to match action references
    # in documentation. If not provided, will be auto-detected from git or
    # GITHUB_REPOSITORY environment variable.
    #
    # Examples:
    # - 'jessehouwing/actions-example-checker'
    # - 'actions/checkout'
    #
    # Default: Auto-detected from git remote or GITHUB_REPOSITORY
    repository: ''

    # Path to the repository root. Use this when your action.yml files are not
    # in the default checkout location or when you need to validate a subdirectory.
    #
    # Examples:
    # - '.' (current directory)
    # - './my-action' (subdirectory)
    # - '/path/to/repo' (absolute path)
    #
    # Default: .
    repository-path: ''

    # Glob pattern to find action files in your repository. The action will search
    # for all files matching this pattern and validate examples against their schemas.
    #
    # The default pattern finds:
    # - action.yml and action.yaml in the root directory
    # - action.yml and action.yaml in any subdirectory
    #
    # Examples:
    # - '{**/,}action.{yml,yaml}' (default - root and all subdirectories)
    # - 'action.yml' (only root directory)
    # - '**/action.yml' (only subdirectories)
    # - 'actions/**/action.{yml,yaml}' (subdirectories under 'actions' folder)
    #
    # Default: {**/,}action.{yml,yaml}
    action-pattern: ''

    # Glob pattern to find documentation files that contain YAML code blocks
    # to validate. The action will scan these files for usage examples.
    #
    # The default pattern finds all Markdown files in the repository, but you can
    # customize it to target specific directories or file types.
    #
    # Examples:
    # - '**/*.md' (default - all Markdown files)
    # - 'README.md' (only root README)
    # - 'docs/**/*.md' (only files in docs directory)
    # - '**/*.{md,markdown}' (Markdown files with either extension)
    #
    # Note: The action also validates YAML examples embedded in action.yml
    # description fields, regardless of this pattern.
    #
    # Default: **/*.md
    docs-pattern: ''
```

<!-- end usage -->

## Advanced Validation with Schema Files

For more precise validation, you can create an optional `action.schema.yml` or `action.schema.yaml` file alongside your `action.yml`. This schema file allows you to define:

- **Type validation**: `boolean`, `number`, `string`, or `choice`
- **Pattern matching**: Validate string inputs against regex patterns
- **Choice validation**: Specify allowed values for inputs
- **Custom types**: Define reusable types for consistency

### Schema File Example

Create `action.schema.yml` next to your `action.yml`:

```yaml
# Define reusable custom types
types:
  url:
    type: string
    match: "^https?://.*"
  semver:
    type: string
    match: "^\\d+\\.\\d+\\.\\d+$"

# Validate inputs
inputs:
  environment:
    type: choice
    options:
      - development
      - staging
      - production
  
  version:
    type: semver  # Reference to custom type
  
  api-url:
    type: url  # Reference to custom type
  
  timeout:
    type: number
  
  dry-run:
    type: boolean
  
  log-level:
    type: string
    match: "^(debug|info|warn|error)$"

# Validate outputs
outputs:
  deployment-id:
    type: string
  deployment-url:
    type: url
```

### Type Definitions

#### Boolean Type
Accepts truthy/falsy values:
- **Truthy**: `true`, `yes`, `y`, `1`, `on`
- **Falsy**: `false`, `no`, `n`, `0`, `off`, `` (empty)

```yaml
inputs:
  enabled:
    type: boolean
```

#### Number Type
Accepts numeric values including scientific notation:
```yaml
inputs:
  timeout:
    type: number
```

#### String Type with Pattern
Validates strings against regex patterns:
```yaml
inputs:
  email:
    type: string
    match: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
```

Regex patterns support both formats:
- Plain string: `"^pattern$"`
- With flags: `"/pattern/i"` (case-insensitive)

#### Choice Type
Restricts input to specific values:
```yaml
inputs:
  log-level:
    type: choice
    options:
      - debug
      - info
      - warning
      - error
```

### Value Normalization

Before validation, values are normalized by:
- Removing leading/trailing whitespace
- Removing enclosing quotes (`"..."` or `'...'`)
- Removing trailing comments (`value # comment`)
- Unindenting multiline values
- Collapsing multiline values to single line
- Skipping non-literal expressions (`${{ secrets.TOKEN }}`)

### Backward Compatibility

Schema files are optional. Without a schema file:
- Explicit `type` field in `action.yml` is still respected
- Basic validation continues to work
- No breaking changes to existing workflows

<!-- end usage -->

### Quick Start

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

### Advanced Examples

#### Custom Patterns

Validate only specific documentation:

```yaml
- uses: jessehouwing/actions-example-checker@v1
  with:
    docs-pattern: 'docs/**/*.md'
    action-pattern: 'action.yml'
```

#### Fork Support

For forked repositories, enable automatic parent detection:

```yaml
- uses: jessehouwing/actions-example-checker@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
```

#### Validate Multiple Actions

For monorepo with multiple actions:

```yaml
- uses: jessehouwing/actions-example-checker@v1
  with:
    action-pattern: 'actions/**/action.{yml,yaml}'
    docs-pattern: 'actions/**/*.md'
```

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
   - If an `action.schema.yml` exists, loads advanced validation rules (types, patterns, custom types)
4. **Documentation Scanning**:
   - Scans markdown files for YAML code blocks (marked with ` ```yaml ` or ` ```yml `)
   - Extracts YAML code blocks from action.yml descriptions (root and input descriptions)
5. **Example Validation**: For each code block containing action usage (identified by `uses: owner/repo@version`):
   - Validates that all `with:` inputs are defined in the action schema
   - Checks input types (boolean, number, string, choice) when specified
   - Validates input values against allowed options (choice type)
   - Validates string inputs against regex patterns (when defined in schema)
   - Validates output references (e.g., `steps.my-step.outputs.result`) exist in the action schema
   - Skips validation for non-literal expressions containing `${{ ... }}`
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

## Validation Sources

The action validates YAML examples from multiple sources:

### 1. Markdown Files

Examples in `*.md` files are validated:

````markdown
# Usage

```yaml
- uses: owner/action@v1
  with:
    input: value
```
````

### 2. Action.yml Descriptions

Examples in `action.yml` descriptions are also validated:

````yaml
name: My Action
description: |-
  Example usage:
  ```yaml
  - uses: owner/my-action@v1
    with:
      mode: standard
````

inputs:
auth-type:
description: |-
Authentication type

      Setup example:
      ```yaml
      - uses: azure/login@v2
        with:
          client-id: abc
      - uses: owner/my-action@v1
        with:
          auth-type: oidc
      ```

````

This ensures that examples in your action.yml file are always correct and up-to-date.

## Advanced Syntax Support

The action supports various YAML syntax features commonly used in GitHub Actions:

### Comments

Trailing comments are supported and stripped before validation:

```yaml
- uses: owner/action@v1
  id: my-step # step identifier
  with:
    environment: production # deployment target
    debug: true # enable debugging
````

Comments inside quoted strings are preserved:

```yaml
- uses: owner/action@v1
  with:
    message: 'Build #123 completed' # hash in string is preserved
```

### Multi-line Values

The action supports YAML literal block scalars (`|`) and folded block scalars (`>`):

```yaml
- uses: owner/action@v1
  with:
    script: |
      echo "Line 1"
      echo "Line 2"
      echo "Line 3"
    description: >
      This is a long description
      that will be folded into
      a single line
```

Multi-line values are validated just like single-line values:

- Type checking applies (boolean, number)
- Option validation applies
- Expressions are still skipped

### Flexible Syntax

```yaml
# With dash
- uses: owner/action@v1
  with:
    input: value

# Without dash
uses: owner/action@v1
with:
  input: value

# Dash without space
-uses: owner/action@v1
  with:
    input: value
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
