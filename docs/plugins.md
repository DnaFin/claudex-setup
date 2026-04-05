# Nerviq Plugin System

Nerviq supports custom checks via a plugin system. You can extend the audit with project-specific or organization-specific checks by creating a `nerviq.config.js` file in your project root.

## Creating a Plugin

1. Create `nerviq.config.js` in your project root.
2. Export an object with a `plugins` array.
3. Each plugin has a `name` and a `checks` object.

```javascript
// nerviq.config.js
module.exports = {
  plugins: [
    {
      name: 'my-org-standards',
      checks: {
        hasChangelog: {
          id: 'ORG-001',
          name: 'Project has a CHANGELOG',
          check: (ctx) => ctx.files.includes('CHANGELOG.md'),
          impact: 'medium',
          category: 'hygiene',
          fix: 'Create a CHANGELOG.md to track project changes.',
          sourceUrl: 'https://keepachangelog.com',
          confidence: 0.9,
        },
        hasCodeOwners: {
          id: 'ORG-002',
          name: 'CODEOWNERS file exists',
          check: (ctx) => ctx.files.includes('CODEOWNERS') || ctx.files.includes('.github/CODEOWNERS'),
          impact: 'high',
          category: 'quality',
          fix: 'Add a CODEOWNERS file to enforce review assignments.',
          sourceUrl: null,
          confidence: 0.8,
        },
      },
    },
  ],
};
```

## Plugin API

### Check Object Format

Each check in the `checks` object must have these **required** fields:

| Field      | Type       | Description                                                    |
|------------|------------|----------------------------------------------------------------|
| `id`       | `string`   | Unique identifier for the check (e.g. `'CUSTOM-001'`).        |
| `name`     | `string`   | Human-readable name shown in audit results.                    |
| `check`    | `function` | `(ctx) => boolean \| null`. Return `true` if passed, `false` if failed, `null` if not applicable. |
| `impact`   | `string`   | One of: `'critical'`, `'high'`, `'medium'`, `'low'`.           |
| `category` | `string`   | Category grouping (e.g. `'custom'`, `'hygiene'`, `'security'`). |
| `fix`      | `string`   | Actionable fix message shown when the check fails.             |

Optional fields:

| Field        | Type     | Default | Description                                        |
|--------------|----------|---------|----------------------------------------------------|
| `sourceUrl`  | `string` | `null`  | URL to documentation or rationale for this check.  |
| `confidence` | `number` | `0.5`   | Confidence level from 0 to 1.                      |

### The Context Object (`ctx`)

The `check` function receives a project context object with these useful properties and methods:

- `ctx.files` -- array of all file paths in the project (relative to root)
- `ctx.fileContent(path)` -- returns file contents as string, or empty string
- `ctx.claudeMdContent()` -- returns CLAUDE.md content
- `ctx.hasDir(path)` -- returns true if directory exists
- `ctx.dirFiles(path)` -- returns array of files in a directory

## How Plugin Checks Appear in Audit Results

Plugin checks are merged into the standard audit and appear alongside built-in checks. In the results, plugin checks are keyed as `plugin:<plugin-name>:<check-key>`. For example, a check `hasChangelog` in plugin `my-org-standards` appears as:

```
plugin:my-org-standards:hasChangelog
```

Plugin checks are scored and weighted using the same `impact`-based system as built-in checks. They appear in:

- The full results list
- Failed check recommendations (if they fail)
- Score calculations

## Validation

Nerviq validates all plugins at load time. Plugins with missing required fields are skipped and an error is logged. You can also validate a plugin programmatically:

```javascript
const { validatePlugin } = require('@nerviq/cli/src/plugins');

const result = validatePlugin(myPlugin);
if (!result.valid) {
  console.error('Plugin errors:', result.errors);
}
```
