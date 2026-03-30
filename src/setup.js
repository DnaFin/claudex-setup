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
    return `# Project Instructions

## Architecture
<!-- Add a Mermaid diagram of your project structure -->

## Stack
${stackNames}

## Build & Test
\`\`\`bash
# Add your build command
# Add your test command
# Add your lint command
\`\`\`

## Code Style
- Follow existing patterns in the codebase
- Write tests for new features

## Workflow
- Verify changes with tests before committing
- Use descriptive commit messages
`;
  },

  'hooks': () => ({
    'on-edit-lint.sh': `#!/bin/bash
# PostToolUse hook - auto-check after file edits
# Customize the linter command for your project
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
echo "[$TIMESTAMP] File changed: $(cat -)" >> .claude/logs/changes.txt
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
      rules['frontend.md'] = `When editing frontend files (*.tsx, *.jsx, *.vue):
- Use functional components with hooks
- Follow existing component patterns
- Add prop types or TypeScript interfaces
`;
    }
    if (hasPython) {
      rules['python.md'] = `When editing Python files:
- Use type hints for function signatures
- Follow PEP 8 conventions
- Use f-strings for formatting
`;
    }
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
