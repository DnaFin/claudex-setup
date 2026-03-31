# Pilot Rollout Kit

## Suggested pilot shape

1. Choose 1-2 repos with active owners and low blast radius.
2. Run `discover`, `suggest-only`, and `governance` before any write flow.
3. Pick one permission profile and document why it fits the pilot.
4. Run `benchmark` to capture a baseline and expected value.
5. Use `plan` and selective `apply` for the first write batch.

## Approval checklist

- Engineering owner approves scope.
- Security owner approves permission profile and hooks.
- Pilot owner records success metrics.
- Rollback expectations are documented before apply.

## Success metrics

- readiness score delta
- organic score delta
- number of proposal bundles accepted
- rollback-free apply rate
- time to first useful Claude workflow

## Rollback expectations

- every apply run must produce a rollback artifact
- rejected starter artifacts are deleted using the rollback manifest
- rollback decisions are logged in the activity trail
