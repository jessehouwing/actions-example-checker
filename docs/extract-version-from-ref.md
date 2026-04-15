# Extracting Version Aliases from a Git Tag

When you publish a GitHub Action you typically push three tags for each release:

| Tag      | Meaning                          |
| -------- | -------------------------------- |
| `v1.2.3` | Exact patch release              |
| `v1.2`   | Minor alias (latest `v1.2.x`)    |
| `v1`     | Major alias (latest `v1.x.x`)    |

The `version` input of `actions-example-checker` validates that every `uses:` reference in your documentation pins to one of the allowed versions. Version matching is **exact** — `v1.2` does **not** match `v1.2.4`.

If you want to accept all three forms you must pass all three to the `version` input. `${{ github.ref_name }}` gives you the full tag, but GitHub Actions expression functions cannot split or substring strings, so the major/minor aliases must be extracted in a prior step.

## Bash (ubuntu / macos runners)

```yaml
on:
  push:
    tags: ['v*.*.*']

jobs:
  validate-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Extract version aliases
        id: semver
        run: |
          full="${{ github.ref_name }}"               # e.g. v1.2.3
          echo "minor=${full%.*}"  >> "$GITHUB_OUTPUT"  # v1.2
          echo "major=${full%%.*}" >> "$GITHUB_OUTPUT"  # v1

      - uses: jessehouwing/actions-example-checker@v1
        with:
          version: |
            ${{ github.ref_name }}
            ${{ steps.semver.outputs.minor }}
            ${{ steps.semver.outputs.major }}
```

### How the shell substitutions work

| Expression      | Input     | Result  | Explanation                                      |
| --------------- | --------- | ------- | ------------------------------------------------ |
| `${full%.*}`    | `v1.2.3`  | `v1.2`  | Remove shortest suffix matching `.*` (last segment) |
| `${full%%.*}`   | `v1.2.3`  | `v1`    | Remove longest suffix matching `.*` (all segments after first) |

These are standard POSIX shell parameter-expansion operators and work in any `sh`-compatible shell (`bash`, `dash`, `sh`).

## PowerShell (windows runners)

```yaml
on:
  push:
    tags: ['v*.*.*']

jobs:
  validate-docs:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Extract version aliases
        id: semver
        shell: pwsh
        run: |
          $full  = "${{ github.ref_name }}"      # e.g. v1.2.3
          $parts = $full -split '\.'
          $minor = "$($parts[0]).$($parts[1])"   # v1.2
          $major = $parts[0]                     # v1
          "minor=$minor" >> $Env:GITHUB_OUTPUT
          "major=$major" >> $Env:GITHUB_OUTPUT

      - uses: jessehouwing/actions-example-checker@v1
        with:
          version: |
            ${{ github.ref_name }}
            ${{ steps.semver.outputs.minor }}
            ${{ steps.semver.outputs.major }}
```

### How the PowerShell splitting works

| Expression                     | Input    | Result | Explanation                          |
| ------------------------------ | -------- | ------ | ------------------------------------ |
| `$full -split '\.'`            | `v1.2.3` | `@('v1','2','3')` | Split on literal `.`       |
| `$parts[0]`                    |          | `v1`   | First element                        |
| `"$($parts[0]).$($parts[1])"` |          | `v1.2` | Join first two elements with `.`     |

## Cross-platform example (single job, ubuntu runner)

The Bash approach runs on every ubuntu/macos runner without any additional setup:

```yaml
on:
  push:
    tags: ['v*.*.*']

jobs:
  validate-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Extract version aliases
        id: semver
        run: |
          full="${{ github.ref_name }}"
          echo "minor=${full%.*}"  >> "$GITHUB_OUTPUT"
          echo "major=${full%%.*}" >> "$GITHUB_OUTPUT"

      - uses: jessehouwing/actions-example-checker@v1
        with:
          # Validate that docs examples reference any of the three published tags
          version: |
            ${{ github.ref_name }}
            ${{ steps.semver.outputs.minor }}
            ${{ steps.semver.outputs.major }}
```

## Important: exact matching only

The `version` input uses **exact** string comparison. A shorter alias never implicitly matches a longer version:

| Allowed version | Example uses        | Result  |
| --------------- | ------------------- | ------- |
| `v1.2`          | `owner/action@v1.2` | ✅ pass |
| `v1.2`          | `owner/action@v1.2.4` | ❌ fail — not an exact match |
| `v1`            | `owner/action@v1.2.4` | ❌ fail — not an exact match |
| `v1`, `v1.2`, `v1.2.4` | `owner/action@v1.2.4` | ✅ pass |

This is intentional: it forces you to be explicit about which published aliases are valid for this release.
