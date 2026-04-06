# Benchmark Scenario Library

These fixture directories represent common project types for benchmark testing.

| Scenario | Description | Expected Score Range |
|----------|-------------|---------------------|
| `empty-node` | Bare Node.js project, no AI config | 0-10 |
| `basic-claude` | CLAUDE.md with commands + mermaid diagram | 20-40 |
| `multi-platform` | CLAUDE.md + AGENTS.md + .cursorrules | 15-30 |

## Usage

```bash
# Benchmark a scenario
nerviq benchmark --external test/fixtures/scenarios/empty-node

# Compare before/after on a scenario
nerviq benchmark --external test/fixtures/scenarios/basic-claude
```
