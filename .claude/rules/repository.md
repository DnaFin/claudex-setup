When changing release, packaging, or workflow files:
- Keep package.json, CHANGELOG.md, README.md, and docs in sync
- Prefer tagged release references over floating branch references in public docs
- Preserve backward compatibility in CLI flags where practical
- Any automation that writes files must document rollback expectations
