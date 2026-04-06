# Getting Started with Nerviq

Choose your path based on your role.

---

## Solo Developer

**Goal:** Score your project, fix the biggest gaps, measure improvement.

```bash
# 1. See where you stand (30 seconds)
npx @nerviq/cli audit

# 2. Fix critical issues automatically
npx @nerviq/cli fix --all-critical

# 3. Generate a safe baseline config
npx @nerviq/cli setup

# 4. Measure the improvement
npx @nerviq/cli benchmark
```

**What you'll get:** CLAUDE.md with architecture diagram, hooks for automated checks, deny rules for secrets protection, and custom commands for your workflow.

**Time:** 5 minutes from install to a well-configured AI agent setup.

---

## Team Lead / DevEx

**Goal:** Standardize AI agent config across your team's repos, add CI gating.

```bash
# 1. Audit your main repo
npx @nerviq/cli audit --full

# 2. Export a shareable report
npx @nerviq/cli suggest-only --out nerviq-report.md

# 3. Set up governance (permission profiles + policy packs)
npx @nerviq/cli governance

# 4. Add CI threshold (fail PR if score < 60)
# In .github/workflows/nerviq.yml:
```

```yaml
name: Nerviq Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: nerviq/nerviq@v1
        with:
          threshold: 60
```

```bash
# 5. Monitor drift over time
npx @nerviq/cli watch
```

**What you'll get:** Consistent agent config across repos, CI-enforced quality baseline, score trending, and governance exports for security review.

---

## Enterprise / Platform Engineering

**Goal:** Align multiple AI coding platforms, detect config drift, enforce compliance.

```bash
# 1. Cross-platform alignment audit
npx @nerviq/cli harmony-audit

# 2. Detect drift between platforms
npx @nerviq/cli harmony-drift

# 3. Sync configs across platforms
npx @nerviq/cli harmony-sync

# 4. Multi-repo scan
npx @nerviq/cli scan repo1/ repo2/ repo3/

# 5. Certification
npx @nerviq/cli certify
```

**What you'll get:** Harmony score showing cross-platform alignment, drift alerts, unified governance across Claude/Codex/Cursor/Copilot/Gemini/Windsurf/Aider/OpenCode, and certification badges.

**Safety controls:**
- `--dry-run` — preview all changes before writing
- `--config-only` — only touch config files, never source code
- `--profile read-only` — no writes at all
- `--snapshot` — automatic backup before every change

---

## Common Next Steps

After your first audit:

| Score | What to do |
|-------|-----------|
| 0-20 | Run `nerviq setup` to generate a baseline |
| 20-50 | Run `nerviq fix --all-critical` then `nerviq augment` |
| 50-70 | Focus on hooks and governance: `nerviq governance` |
| 70-90 | Fine-tune: `nerviq audit --full --verbose` for all recommendations |
| 90+ | Maintain: `nerviq watch` and CI threshold |

## Need help?

- **Docs:** [nerviq.net](https://nerviq.net)
- **GitHub:** [github.com/nerviq/nerviq](https://github.com/nerviq/nerviq)
- **Discord:** [Join the community](https://discord.gg/nerviq)
