Pre-deployment checklist.

## Pre-deploy:
1. Run `git status` — working tree must be clean
2. Run full test suite — all tests must pass
3. Run linter — no errors
4. Verify no secrets in staged changes
5. Review diff since last deploy

## Deploy:
1. Confirm target environment
2. Run deployment command
3. Verify deployment (health check)
4. Tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
