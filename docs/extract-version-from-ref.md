# Extracting Version Aliases from a Git Tag

When you publish a GitHub Action you typically push three tags for each release:

| Tag      | Meaning                       |
| -------- | ----------------------------- |
| `v1.2.3` | Exact patch release           |
| `v1.2`   | Minor alias (latest `v1.2.x`) |
| `v1`     | Major alias (latest `v1.x.x`) |

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
        env:
          REF_NAME: ${{ github.ref_name }}
        run: |
          full="$REF_NAME"                            # e.g. v1.2.3
          echo "minor=${full%.*}"  >> "$GITHUB_OUTPUT"  # v1.2
          echo "major=${full%%.*}" >> "$GITHUB_OUTPUT"  # v1

      - uses: jessehouwing/actions-example-checker@v0.0.8
        with:
          version: |
            ${{ github.ref_name }}
            ${{ steps.semver.outputs.minor }}
            ${{ steps.semver.outputs.major }}
```

### How the shell substitutions work

| Expression    | Input    | Result | Explanation                                                    |
| ------------- | -------- | ------ | -------------------------------------------------------------- |
| `${full%.*}`  | `v1.2.3` | `v1.2` | Remove shortest suffix matching `.*` (last segment)            |
| `${full%%.*}` | `v1.2.3` | `v1`   | Remove longest suffix matching `.*` (all segments after first) |

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
        env:
          REF_NAME: ${{ github.ref_name }}
        run: |
          $full  = $env:REF_NAME              # e.g. v1.2.3
          $parts = $full -split '\.'
          $minor = "$($parts[0]).$($parts[1])"   # v1.2
          $major = $parts[0]                     # v1
          "minor=$minor" >> $Env:GITHUB_OUTPUT
          "major=$major" >> $Env:GITHUB_OUTPUT

      - uses: jessehouwing/actions-example-checker@v0.0.8
        with:
          version: |
            ${{ github.ref_name }}
            ${{ steps.semver.outputs.minor }}
            ${{ steps.semver.outputs.major }}
```

### How the PowerShell splitting works

| Expression                    | Input    | Result            | Explanation                      |
| ----------------------------- | -------- | ----------------- | -------------------------------- |
| `$full -split '\.'`           | `v1.2.3` | `@('v1','2','3')` | Split on literal `.`             |
| `$parts[0]`                   |          | `v1`              | First element                    |
| `"$($parts[0]).$($parts[1])"` |          | `v1.2`            | Join first two elements with `.` |

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
        env:
          REF_NAME: ${{ github.ref_name }}
        run: |
          full="$REF_NAME"
          echo "minor=${full%.*}"  >> "$GITHUB_OUTPUT"
          echo "major=${full%%.*}" >> "$GITHUB_OUTPUT"

      - uses: jessehouwing/actions-example-checker@v0.0.8
        with:
          # Validate that docs examples reference any of the three published tags
          version: |
            ${{ github.ref_name }}
            ${{ steps.semver.outputs.minor }}
            ${{ steps.semver.outputs.major }}
```

## Finding the highest version tag

To find the latest release version from all tags in your repository, you can use `git tag --list` or the `gh api` command to list tags, filter them by the `vx.y.z` pattern, sort them semantically, and extract the highest version.

### Bash with git tag --list

```bash
# Find all tags matching vx.y.z, sort semantically, and get the latest
latest=$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-version:refname | head -n1)
echo "Latest version: $latest"
```

### Bash with GitHub CLI (gh)

```bash
# Query repository tags via GitHub API, filter by pattern, and get the latest
latest=$(gh api repos/:owner/:repo/tags \
  --jq '.[] | select(.name | test("^v[0-9]+\\.[0-9]+\\.[0-9]+$")) | .name' \
  | sort -V | tail -n1)
echo "Latest version: $latest"
```

### PowerShell with git

```powershell
# Find all tags matching vx.y.z, sort semantically, and get the latest
$tags = git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-version:refname
$latest = $tags[0]
Write-Host "Latest version: $latest"
```

### GitHub Actions workflow example

```yaml
on:
  workflow_dispatch:

jobs:
  find-latest-version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Fetch all tags

      - name: Find latest version tag
        id: version
        run: |
          latest=$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-version:refname | head -n1)
          if [ -z "$latest" ]; then
            echo "No version tags found matching vx.y.z pattern"
            exit 1
          fi
          echo "tag=$latest" >> "$GITHUB_OUTPUT"

      - uses: jessehouwing/actions-example-checker@v0.0.8
        with:
          version: ${{ steps.version.outputs.tag }}
```

### Alternative using gh CLI in workflow

```yaml
jobs:
  find-latest-version:
    runs-on: ubuntu-latest
    steps:
      - name: Find latest version tag
        id: version
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          REPOSITORY: ${{ github.repository }}
        run: |
          latest=$(gh api "repos/$REPOSITORY/tags" \
            --jq '.[] | select(.name | test("^v[0-9]+\\.[0-9]+\\.[0-9]+$")) | .name' \
            | sort -V | tail -n1)
          echo "tag=$latest" >> "$GITHUB_OUTPUT"

      - uses: jessehouwing/actions-example-checker@v0.0.8
        with:
          version: ${{ steps.version.outputs.tag }}
```

### How the sorting works

| Tool                       | Command                                         | Notes                                              |
| -------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| `git tag --sort=-version:` | `-version:refname`                              | Semantic version sort; `-` reverses (newest first) |
| `sort -V`                  | Version-aware sort; pipe to `tail -n1` for last | Last item is numerically highest                   |
| `gh api --jq`              | Filter + pipe to other sort tools               | Flexible; requires GH_TOKEN for private repos      |

## Important: exact matching only

The `version` input uses **exact** string comparison. A shorter alias never implicitly matches a longer version:

| Allowed version        | Example uses          | Result                       |
| ---------------------- | --------------------- | ---------------------------- |
| `v1.2`                 | `owner/action@v1.2`   | ✅ pass                      |
| `v1.2`                 | `owner/action@v1.2.4` | ❌ fail — not an exact match |
| `v1`                   | `owner/action@v1.2.4` | ❌ fail — not an exact match |
| `v1`, `v1.2`, `v1.2.4` | `owner/action@v1.2.4` | ✅ pass                      |

This is intentional: it forces you to be explicit about which published aliases are valid for this release.
