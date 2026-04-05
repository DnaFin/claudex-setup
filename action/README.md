# nerviq GitHub Action

Score your Claude Code setup against 84 checks and get feedback directly on pull requests.

## Usage

### Basic (score only, no threshold)

```yaml
name: Claude Code Audit
on: [pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: nerviq/nerviq/action@main
```

### With threshold (fail if score is too low)

```yaml
name: Claude Code Audit
on: [pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: nerviq/nerviq/action@main
        with:
          threshold: '50'
```

### Without PR comment

```yaml
name: Claude Code Audit
on: [push]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: nerviq/nerviq/action@main
        with:
          comment: 'false'
```

### Using outputs in subsequent steps

```yaml
name: Claude Code Audit
on: [pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: nerviq/nerviq/action@main
        id: audit
      - run: echo "Score is ${{ steps.audit.outputs.score }}/100"
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `threshold` | Minimum passing score (0-100). The step fails if the score is below this value. | No | `0` (no threshold) |
| `comment` | Post the score as a PR comment (`true`/`false`). Updates an existing comment if one is found. | No | `true` |

## Outputs

| Output | Description |
|--------|-------------|
| `score` | Audit score (0-100) |
| `passed` | Number of passing checks |
| `failed` | Number of failing checks |

## How it works

1. Installs Node.js 20 and runs `npx @nerviq/cli --json` on the checked-out repository.
2. Parses the JSON output to extract `score`, `passed`, `failed`, and `checkCount`.
3. If running on a `pull_request` event and `comment` is `true`, posts (or updates) a comment on the PR with the score and a color-coded emoji.
4. If `threshold` is set to a non-zero value, fails the step when the score is below the threshold.
