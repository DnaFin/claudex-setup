# claudex-setup Release Checklist

Use this before tagging or publishing a release.

## Code And Packaging

- bump `package.json` version intentionally
- update `CHANGELOG.md` with the shipped changes
- run `npm test`
- run `npm pack --dry-run`

## Product Surface Consistency

- verify `README.md` reflects the current CLI surface
- verify `docs/index.html` reflects the current CLI surface
- verify new flags and commands appear in `--help`
- verify proof numbers and public claims match the current state

## Trust And Governance

- run `npx claudex-setup --snapshot` on the repo itself
- run `npx claudex-setup governance --out governance.md`
- verify MCP package names and env preflight behavior for changed packs
- verify no recommendation regressions on known scenarios

## Release Readiness

- confirm npm publish target and account are correct
- confirm git branch / commit matches the intended release
- confirm any new templates or content files are included in the package
- capture one final note about what changed and what still remains intentionally deferred
