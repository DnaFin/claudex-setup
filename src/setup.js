/**
 * Setup engine - applies recommended Claude Code configuration to a project.
 */

const fs = require('fs');
const path = require('path');
const { TECHNIQUES, STACKS } = require('./techniques');
const { ProjectContext } = require('./context');
const { audit } = require('./audit');

const TEMPLATES = {
  'claude-md': (stacks) => {
    const stackNames = stacks.map(s => s.label).join(', ') || 'General';
    const stackKeys = stacks.map(s => s.key);
    const hasJS = stackKeys.some(k => ['typescript', 'react', 'vue', 'angular', 'nextjs', 'node'].includes(k));
    const hasPython = stackKeys.includes('python');

    let buildCommands = '# Add your build command\n# Add your test command\n# Add your lint command';
    if (hasJS) {
      buildCommands = `npm run build        # or: npx tsc --noEmit
npm test             # or: npx jest / npx vitest
npm run lint         # or: npx eslint .`;
    } else if (hasPython) {
      buildCommands = `python -m pytest     # run tests
python -m mypy .     # type checking
ruff check .         # lint`;
    }

    let stackSection = '';
    if (hasJS) {
      stackSection = `
## Stack-Specific
- Prefer functional components with hooks (React)
- Use TypeScript interfaces over \`type\` where possible
- Use \`async/await\` over raw Promises
- Import order: stdlib > external > internal > relative
`;
    } else if (hasPython) {
      stackSection = `
## Stack-Specific
- Use type hints on all function signatures
- Follow PEP 8 conventions; use f-strings for formatting
- Prefer pathlib over os.path
- Use dataclasses or pydantic for structured data
`;
    }

    return `# Project Instructions

## Architecture
\`\`\`mermaid
graph TD
    A[Entry Point] --> B[Core Logic]
    B --> C[Data Layer]
    B --> D[API / Routes]
    C --> E[(Database)]
    D --> F[External Services]
\`\`\`
<!-- Replace with your actual project architecture -->

## Stack
${stackNames}
${stackSection}
## Build & Test
\`\`\`bash
${buildCommands}
\`\`\`

## Code Style
- Follow existing patterns in the codebase
- Write tests for new features
- Keep functions small and focused (< 50 lines)
- Use descriptive variable names; avoid abbreviations

## Constraints
<constraints>
- Never commit secrets, API keys, or .env files
- Always run tests before marking work complete
- Prefer editing existing files over creating new ones
- When uncertain about architecture, ask before implementing
</constraints>

## Verification
<verification>
Before completing any task, confirm:
1. All existing tests still pass
2. New code has test coverage
3. No linting errors introduced
4. Changes match the requested scope (no gold-plating)
</verification>

## Workflow
- Verify changes with tests before committing
- Use descriptive commit messages (why, not what)
- Create focused PRs — one concern per PR
- Document non-obvious decisions in code comments
`;
  },

  'hooks': () => ({
    'on-edit-lint.sh': `#!/bin/bash
# PostToolUse hook - auto-check after file edits
# Customize the linter command for your project
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
echo "[$TIMESTAMP] File changed: $(cat -)" >> .claude/logs/changes.txt
`,
    'protect-secrets.sh': `#!/bin/bash
# PreToolUse hook - warn before touching sensitive files
# Prevents accidental reads/writes to files containing secrets

INPUT=$(cat -)
FILE=$(echo "$INPUT" | grep -oP '"file_path"\\s*:\\s*"\\K[^"]+' 2>/dev/null || echo "")

if [ -z "$FILE" ]; then
  exit 0
fi

BASENAME=$(basename "$FILE")

case "$BASENAME" in
  .env|.env.*|*.pem|*.key|credentials.json|secrets.yaml|secrets.yml)
    echo "WARN: Attempting to access sensitive file: $BASENAME"
    echo "This file may contain secrets. Proceed with caution."
    ;;
esac

exit 0
`,
  }),

  'commands': () => ({
    'test.md': `Run the test suite and report results.

## Steps:
1. Run the project's test command
2. If tests fail, analyze the failures
3. Report: total, passed, failed, and any error details
`,
    'review.md': `Review the current changes for quality and correctness.

## Steps:
1. Run \`git diff\` to see all changes
2. Check for: bugs, security issues, missing tests, code style
3. Provide actionable feedback
`,
    'deploy.md': `Pre-deployment checklist and deployment steps.

## Pre-deploy checks:
1. Run \`git status\` — working tree must be clean
2. Run full test suite — all tests must pass
3. Run linter — no errors allowed
4. Check for TODO/FIXME/HACK comments in changed files
5. Verify no secrets in staged changes (\`git diff --cached\`)

## Deploy steps:
1. Confirm target environment (staging vs production)
2. Review the diff since last deploy tag
3. Run the deployment command
4. Verify deployment succeeded (health check / smoke test)
5. Tag the release: \`git tag -a vX.Y.Z -m "Release vX.Y.Z"\`
`,
  }),

  'skills': () => ({
    'fix-issue/SKILL.md': `---
name: fix-issue
description: Fix a GitHub issue by number
---
Fix the GitHub issue: $ARGUMENTS

1. Read the issue details
2. Search the codebase for relevant files
3. Implement the fix
4. Write tests
5. Create a descriptive commit
`,
  }),

  'rules': (stacks) => {
    const rules = {};
    const hasTS = stacks.some(s => s.key === 'typescript');
    const hasPython = stacks.some(s => s.key === 'python');

    if (hasTS || stacks.some(s => ['react', 'vue', 'angular', 'nextjs', 'node'].includes(s.key))) {
      rules['frontend.md'] = `When editing JavaScript/TypeScript files (*.ts, *.tsx, *.js, *.jsx, *.vue):
- Use functional components with hooks (React/Vue 3)
- Add TypeScript interfaces for all props and function params
- Prefer \`const\` over \`let\`; never use \`var\`
- Use named exports over default exports
- Handle errors explicitly — no empty catch blocks
- Keep component files under 200 lines; extract sub-components
`;
    }
    if (hasPython) {
      rules['python.md'] = `When editing Python files (*.py):
- Use type hints for all function signatures and return types
- Follow PEP 8 conventions; max line length 88 (black default)
- Use f-strings for string formatting
- Prefer pathlib.Path over os.path
- Use \`if __name__ == "__main__":\` guard in scripts
- Raise specific exceptions, never bare \`except:\`
`;
    }
    rules['tests.md'] = `When writing or editing test files:
- Each test must have a clear, descriptive name (test_should_X_when_Y)
- Follow Arrange-Act-Assert (AAA) pattern
- One assertion per test when practical
- Never skip or disable tests without a tracking issue
- Mock external dependencies, not internal logic
- Include both happy path and edge case tests
`;
    return rules;
  },

  'agents': () => ({
    'security-reviewer.md': `---
name: security-reviewer
description: Reviews code for security vulnerabilities
tools: [Read, Grep, Glob]
model: sonnet
---
Review code for security issues:
- Injection vulnerabilities (SQL, XSS, command injection)
- Authentication and authorization flaws
- Secrets or credentials in code
- Insecure data handling
`,
  }),

  'mermaid': () => `\`\`\`mermaid
graph TD
    A[Entry Point] --> B[Core Logic]
    B --> C[Data Layer]
    B --> D[API / Routes]
    C --> E[(Database)]
    D --> F[External Services]
\`\`\`
`,
};

async function setup(options) {
  const ctx = new ProjectContext(options.dir);
  const stacks = ctx.detectStacks(STACKS);

  console.log('');
  console.log('\x1b[1m  claudex-setup\x1b[0m');
  console.log('\x1b[2m  ═══════════════════════════════════════\x1b[0m');

  if (stacks.length > 0) {
    console.log(`\x1b[36m  Detected: ${stacks.map(s => s.label).join(', ')}\x1b[0m`);
  }
  console.log('');

  let created = 0;

  for (const [key, technique] of Object.entries(TECHNIQUES)) {
    if (technique.passed || technique.check(ctx)) continue;
    if (!technique.template) continue;

    const template = TEMPLATES[technique.template];
    if (!template) continue;

    const result = template(stacks);

    if (typeof result === 'string') {
      // Single file template (like CLAUDE.md)
      const filePath = key === 'claudeMd' ? 'CLAUDE.md' : key;
      const fullPath = path.join(options.dir, filePath);

      if (!fs.existsSync(fullPath)) {
        fs.writeFileSync(fullPath, result, 'utf8');
        console.log(`  \x1b[32m✅\x1b[0m Created ${filePath}`);
        created++;
      }
    } else if (typeof result === 'object') {
      // Multiple files template (hooks, commands, etc)
      const dirMap = {
        'hooks': '.claude/hooks',
        'commands': '.claude/commands',
        'skills': '.claude/skills',
        'rules': '.claude/rules',
        'agents': '.claude/agents',
      };
      const targetDir = dirMap[technique.template] || `.claude/${technique.template}`;
      const fullDir = path.join(options.dir, targetDir);

      if (!fs.existsSync(fullDir)) {
        fs.mkdirSync(fullDir, { recursive: true });
      }

      for (const [fileName, content] of Object.entries(result)) {
        const filePath = path.join(fullDir, fileName);
        const fileDir = path.dirname(filePath);
        if (!fs.existsSync(fileDir)) {
          fs.mkdirSync(fileDir, { recursive: true });
        }
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, content, 'utf8');
          console.log(`  \x1b[32m✅\x1b[0m Created ${path.relative(options.dir, filePath)}`);
          created++;
        }
      }
    }
  }

  if (created === 0) {
    console.log('  \x1b[32m✅\x1b[0m Project already well configured!');
  } else {
    console.log('');
    console.log(`  \x1b[1m${created} files created.\x1b[0m`);
  }

  console.log('');
  console.log('  Run \x1b[1mnpx claudex-setup audit\x1b[0m to check your score.');
  console.log('');
}

module.exports = { setup };
