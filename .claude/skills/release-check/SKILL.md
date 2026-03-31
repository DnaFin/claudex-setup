---
name: release-check
description: Prepare a release candidate and verify publish readiness
---
Prepare a release candidate for: $ARGUMENTS

1. Read CHANGELOG.md and package.json version
2. Run the test suite and packaging checks
3. Verify docs, tags, and release notes are aligned
4. Flag anything that would make the release unsafe or misleading
