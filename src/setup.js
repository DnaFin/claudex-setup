/**
 * Setup engine - applies recommended Claude Code configuration to a project.
 * v0.3.0 - Smart CLAUDE.md generation with project analysis.
 */

const fs = require('fs');
const path = require('path');
const { TECHNIQUES, STACKS } = require('./techniques');
const { ProjectContext } = require('./context');
const { audit } = require('./audit');

// ============================================================
// Helper: detect project scripts from package.json
// ============================================================
function detectScripts(ctx) {
  const pkg = ctx.jsonFile('package.json');
  if (!pkg || !pkg.scripts) return {};
  const relevant = ['test', 'build', 'lint', 'dev', 'start', 'format', 'typecheck', 'check'];
  const found = {};
  for (const key of relevant) {
    if (pkg.scripts[key]) {
      found[key] = pkg.scripts[key];
    }
  }
  return found;
}

// ============================================================
// Helper: detect key dependencies and generate guidelines
// ============================================================
function detectDependencies(ctx) {
  const pkg = ctx.jsonFile('package.json');
  if (!pkg) return [];
  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const guidelines = [];

  // Data fetching
  if (allDeps['@tanstack/react-query']) {
    guidelines.push('- Use React Query (TanStack Query) for all server data fetching — never raw useEffect + fetch');
    guidelines.push('- Define query keys as constants. Invalidate related queries after mutations');
  }
  if (allDeps['swr']) {
    guidelines.push('- Use SWR for data fetching with automatic revalidation');
  }

  // Validation
  if (allDeps['zod']) {
    guidelines.push('- Use Zod for all input validation and type inference (z.infer<typeof schema>)');
    guidelines.push('- Define schemas in a shared location. Use .parse() at API boundaries');
  }

  // ORM / Database
  if (allDeps['prisma'] || allDeps['@prisma/client']) {
    guidelines.push('- Use Prisma for all database operations. Run `npx prisma generate` after schema changes');
    guidelines.push('- Never write raw SQL unless Prisma cannot express the query');
  }
  if (allDeps['drizzle-orm']) {
    guidelines.push('- Use Drizzle ORM for database operations. Schema-first approach');
  }
  if (allDeps['mongoose']) {
    guidelines.push('- Use Mongoose for MongoDB operations. Define schemas with validation');
  }

  // Auth
  if (allDeps['next-auth'] || allDeps['@auth/core']) {
    guidelines.push('- Use NextAuth.js for authentication. Access session via auth() in Server Components');
  }
  if (allDeps['clerk'] || allDeps['@clerk/nextjs']) {
    guidelines.push('- Use Clerk for authentication. Protect routes with middleware');
  }

  // State management
  if (allDeps['zustand']) {
    guidelines.push('- Use Zustand for client state. Keep stores small and focused');
  }
  if (allDeps['@reduxjs/toolkit']) {
    guidelines.push('- Use Redux Toolkit for state management. Use createSlice and RTK Query');
  }

  // Styling
  if (allDeps['tailwindcss']) {
    guidelines.push('- Use Tailwind CSS for all styling. Avoid inline styles and CSS modules');
  }
  if (allDeps['styled-components'] || allDeps['@emotion/react']) {
    guidelines.push('- Use CSS-in-JS for component styling. Colocate styles with components');
  }

  // Testing
  if (allDeps['vitest']) {
    guidelines.push('- Use Vitest for testing. Colocate test files with source (*.test.ts)');
  }
  if (allDeps['jest']) {
    guidelines.push('- Use Jest for testing. Follow existing test patterns in the codebase');
  }
  if (allDeps['playwright'] || allDeps['@playwright/test']) {
    guidelines.push('- Use Playwright for E2E tests. Keep tests in tests/ or e2e/');
  }

  // Python
  const reqTxt = ctx.fileContent('requirements.txt') || '';
  if (reqTxt.includes('sqlalchemy')) {
    guidelines.push('- Use SQLAlchemy for all database operations');
  }
  if (reqTxt.includes('pydantic')) {
    guidelines.push('- Use Pydantic for data validation and serialization');
  }
  if (reqTxt.includes('pytest')) {
    guidelines.push('- Use pytest for testing. Run with `python -m pytest`');
  }

  return guidelines;
}

// ============================================================
// Helper: detect main directories
// ============================================================
function detectMainDirs(ctx) {
  const candidates = ['src', 'lib', 'app', 'pages', 'components', 'api', 'routes', 'utils', 'helpers', 'services', 'models', 'controllers', 'views', 'public', 'assets', 'config', 'tests', 'test', '__tests__', 'spec', 'scripts', 'prisma', 'db', 'middleware', 'hooks'];
  // Also check inside src/ for nested structure (common in Next.js, React)
  const srcNested = ['src/components', 'src/app', 'src/pages', 'src/api', 'src/lib', 'src/hooks', 'src/utils', 'src/services', 'src/models', 'src/middleware', 'src/app/api', 'app/api'];
  const found = [];
  const seenNames = new Set();

  for (const dir of [...candidates, ...srcNested]) {
    if (ctx.hasDir(dir)) {
      const files = ctx.dirFiles(dir);
      const displayName = dir.includes('/') ? dir : dir;
      if (!seenNames.has(displayName)) {
        found.push({ name: displayName, fileCount: files.length, files: files.slice(0, 10) });
        seenNames.add(displayName);
      }
    }
  }
  return found;
}

// ============================================================
// Helper: generate Mermaid diagram from directory structure
// ============================================================
function generateMermaid(dirs, stacks) {
  const stackKeys = stacks.map(s => s.key);
  const dirNames = dirs.map(d => d.name);

  // Build nodes based on what exists
  const nodes = [];
  const edges = [];
  let nodeId = 0;
  const ids = {};

  function addNode(label, shape) {
    const id = String.fromCharCode(65 + nodeId++); // A, B, C...
    ids[label] = id;
    if (shape === 'db') return `    ${id}[(${label})]`;
    if (shape === 'round') return `    ${id}(${label})`;
    return `    ${id}[${label}]`;
  }

  // Detect Next.js App Router specifically
  const hasAppRouter = dirNames.includes('app') || dirNames.includes('src/app');
  const hasPages = dirNames.includes('pages') || dirNames.includes('src/pages');
  const hasAppApi = dirNames.includes('app/api') || dirNames.includes('src/app/api');
  const hasSrcComponents = dirNames.includes('src/components') || dirNames.includes('components');
  const hasSrcHooks = dirNames.includes('src/hooks') || dirNames.includes('hooks');
  const hasSrcLib = dirNames.includes('src/lib') || dirNames.includes('lib');

  // Smart entry point based on framework
  const isNextJs = stackKeys.includes('nextjs');
  const isDjango = stackKeys.includes('django');
  const isFastApi = stackKeys.includes('fastapi');

  if (isNextJs) {
    nodes.push(addNode('Next.js', 'round'));
  } else if (isDjango) {
    nodes.push(addNode('Django', 'round'));
  } else if (isFastApi) {
    nodes.push(addNode('FastAPI', 'round'));
  } else {
    nodes.push(addNode('Entry Point', 'round'));
  }

  const root = ids['Next.js'] || ids['Django'] || ids['FastAPI'] || ids['Entry Point'];

  // Detect layers
  if (hasAppRouter || hasPages) {
    const label = hasAppRouter ? 'App Router' : 'Pages';
    nodes.push(addNode(label, 'default'));
    edges.push(`    ${root} --> ${ids[label]}`);
  }

  if (hasAppApi) {
    nodes.push(addNode('API Routes', 'default'));
    const parent = ids['App Router'] || ids['Pages'] || root;
    edges.push(`    ${parent} --> ${ids['API Routes']}`);
  }

  if (hasSrcComponents) {
    nodes.push(addNode('Components', 'default'));
    const parent = ids['App Router'] || ids['Pages'] || root;
    edges.push(`    ${parent} --> ${ids['Components']}`);
  }

  if (hasSrcHooks) {
    nodes.push(addNode('Hooks', 'default'));
    const parent = ids['Components'] || root;
    edges.push(`    ${parent} --> ${ids['Hooks']}`);
  }

  if (hasSrcLib) {
    nodes.push(addNode('lib/', 'default'));
    const parent = ids['API Routes'] || ids['Hooks'] || ids['Components'] || root;
    edges.push(`    ${parent} --> ${ids['lib/']}`);
  } else if (dirNames.includes('src') && !hasAppRouter && !hasPages) {
    nodes.push(addNode('src/', 'default'));
    edges.push(`    ${root} --> ${ids['src/']}`);
  }

  if (dirNames.includes('api') || dirNames.includes('routes') || dirNames.includes('controllers')) {
    const label = dirNames.includes('api') ? 'API Layer' : 'Routes';
    nodes.push(addNode(label, 'default'));
    const parent = ids['src/'] || ids['Entry Point'];
    edges.push(`    ${parent} --> ${ids[label]}`);
  }

  if (dirNames.includes('services')) {
    nodes.push(addNode('Services', 'default'));
    const parent = ids['API Layer'] || ids['Routes'] || ids['src/'] || ids['Entry Point'];
    edges.push(`    ${parent} --> ${ids['Services']}`);
  }

  if (dirNames.includes('models') || dirNames.includes('prisma') || dirNames.includes('db')) {
    nodes.push(addNode('Data Layer', 'default'));
    const parent = ids['Services'] || ids['API Layer'] || ids['Routes'] || ids['src/'] || ids['Entry Point'];
    edges.push(`    ${parent} --> ${ids['Data Layer']}`);
    nodes.push(addNode('Database', 'db'));
    edges.push(`    ${ids['Data Layer']} --> ${ids['Database']}`);
  }

  if (dirNames.includes('utils') || dirNames.includes('helpers')) {
    nodes.push(addNode('Utils', 'default'));
    const parent = ids['src/'] || ids['Services'] || ids['Entry Point'];
    edges.push(`    ${parent} --> ${ids['Utils']}`);
  }

  if (dirNames.includes('middleware')) {
    nodes.push(addNode('Middleware', 'default'));
    const parent = ids['API Layer'] || ids['Routes'] || ids['Entry Point'];
    edges.push(`    ${parent} --> ${ids['Middleware']}`);
  }

  if (dirNames.includes('tests') || dirNames.includes('test') || dirNames.includes('__tests__') || dirNames.includes('spec')) {
    nodes.push(addNode('Tests', 'round'));
    const parent = ids['src/'] || ids['Entry Point'];
    edges.push(`    ${ids['Tests']} -.-> ${parent}`);
  }

  // Fallback: if we only have Entry Point, make a generic diagram
  if (nodes.length <= 1) {
    return `\`\`\`mermaid
graph TD
    A[Entry Point] --> B[Core Logic]
    B --> C[Data Layer]
    B --> D[API / Routes]
    C --> E[(Database)]
    D --> F[External Services]
\`\`\`
<!-- Update this diagram to match your actual architecture -->`;
  }

  return '```mermaid\ngraph TD\n' + nodes.join('\n') + '\n' + edges.join('\n') + '\n```';
}

// ============================================================
// Helper: framework-specific instructions
// ============================================================
function getFrameworkInstructions(stacks) {
  const stackKeys = stacks.map(s => s.key);
  const sections = [];

  if (stackKeys.includes('nextjs')) {
    sections.push(`### Next.js
- Use App Router conventions (app/ directory) when applicable
- Prefer Server Components by default; add 'use client' only when needed
- Use next/image for images, next/link for navigation
- API routes go in app/api/ (App Router) or pages/api/ (Pages Router)
- Use loading.tsx, error.tsx, and not-found.tsx for route-level UX`);
  } else if (stackKeys.includes('react')) {
    sections.push(`### React
- Use functional components with hooks exclusively
- Prefer named exports over default exports
- Keep components under 150 lines; extract sub-components
- Use custom hooks to share stateful logic
- Colocate styles, tests, and types with components`);
  }

  if (stackKeys.includes('vue')) {
    sections.push(`### Vue
- Use Composition API with \`<script setup>\` syntax
- Prefer defineProps/defineEmits macros
- Keep components under 200 lines
- Use composables for shared logic`);
  }

  if (stackKeys.includes('angular')) {
    sections.push(`### Angular
- Use standalone components when possible
- Follow Angular style guide naming conventions
- Use reactive forms over template-driven forms
- Keep services focused on a single responsibility`);
  }

  if (stackKeys.includes('typescript')) {
    sections.push(`### TypeScript
- Use \`interface\` for object shapes, \`type\` for unions/intersections
- Enable strict mode in tsconfig.json
- Avoid \`any\` — use \`unknown\` and narrow with type guards
- Prefer \`as const\` assertions over enum when practical
- Export types alongside their implementations`);
  }

  if (stackKeys.includes('django')) {
    sections.push(`### Django
- Follow fat models, thin views pattern
- Use class-based views for complex logic, function views for simple
- Always use Django ORM; avoid raw SQL unless necessary
- Keep business logic in models or services, not views`);
  } else if (stackKeys.includes('fastapi')) {
    sections.push(`### FastAPI
- Use Pydantic models for request/response validation
- Use dependency injection for shared logic
- Keep route handlers thin; delegate to service functions
- Use async def for I/O-bound endpoints`);
  }

  if (stackKeys.includes('python') || stackKeys.includes('django') || stackKeys.includes('fastapi')) {
    sections.push(`### Python
- Use type hints on all function signatures and return types
- Follow PEP 8; use f-strings for formatting
- Prefer pathlib over os.path
- Use dataclasses or pydantic for structured data
- Raise specific exceptions; never bare \`except:\``);
  }

  if (stackKeys.includes('rust')) {
    sections.push(`### Rust
- Prefer Result<T, E> over unwrap/expect in library code
- Use clippy warnings as errors
- Derive common traits (Debug, Clone, PartialEq) where appropriate
- Use modules to organize code; keep lib.rs/main.rs thin`);
  }

  if (stackKeys.includes('go')) {
    sections.push(`### Go
- Follow standard project layout conventions
- Handle all errors explicitly; no blank _ for errors
- Use interfaces for testability and abstraction
- Keep packages focused; avoid circular dependencies`);
  }

  const hasJS = stackKeys.some(k => ['react', 'vue', 'angular', 'nextjs', 'node', 'svelte'].includes(k));
  if (hasJS && !stackKeys.includes('typescript')) {
    sections.push(`### JavaScript
- Use \`const\` by default, \`let\` when reassignment needed; never \`var\`
- Use \`async/await\` over raw Promises
- Use named exports over default exports
- Import order: stdlib > external > internal > relative`);
  }

  return sections.join('\n\n');
}

// ============================================================
// TEMPLATES
// ============================================================

const TEMPLATES = {
  'claude-md': (stacks, ctx) => {
    const stackNames = stacks.map(s => s.label).join(', ') || 'General';
    const stackKeys = stacks.map(s => s.key);

    // --- Detect project details ---
    const scripts = detectScripts(ctx);
    const mainDirs = detectMainDirs(ctx);
    const hasTS = stackKeys.includes('typescript') || ctx.files.includes('tsconfig.json');
    const hasPython = stackKeys.includes('python') || stackKeys.includes('django') || stackKeys.includes('fastapi');
    const hasJS = stackKeys.some(k => ['react', 'vue', 'angular', 'nextjs', 'node', 'svelte'].includes(k));

    // --- Build commands section ---
    let buildSection = '';
    if (Object.keys(scripts).length > 0) {
      const lines = [];
      if (scripts.dev) lines.push(`npm run dev          # ${scripts.dev}`);
      if (scripts.start) lines.push(`npm start            # ${scripts.start}`);
      if (scripts.build) lines.push(`npm run build        # ${scripts.build}`);
      if (scripts.test) lines.push(`npm test             # ${scripts.test}`);
      if (scripts.lint) lines.push(`npm run lint         # ${scripts.lint}`);
      if (scripts.format) lines.push(`npm run format       # ${scripts.format}`);
      if (scripts.typecheck) lines.push(`npm run typecheck    # ${scripts.typecheck}`);
      if (scripts.check) lines.push(`npm run check        # ${scripts.check}`);
      buildSection = lines.join('\n');
    } else if (hasPython) {
      buildSection = `python -m pytest     # run tests
python -m mypy .     # type checking
ruff check .         # lint`;
    } else if (hasJS) {
      buildSection = `npm run build        # or: npx tsc --noEmit
npm test             # or: npx jest / npx vitest
npm run lint         # or: npx eslint .`;
    } else {
      buildSection = '# Add your build command\n# Add your test command\n# Add your lint command';
    }

    // --- Architecture description ---
    const mermaid = generateMermaid(mainDirs, stacks);

    let dirDescription = '';
    if (mainDirs.length > 0) {
      dirDescription = '\n### Directory Structure\n';
      for (const dir of mainDirs) {
        const suffix = dir.fileCount > 0 ? ` (${dir.fileCount} files)` : '';
        dirDescription += `- \`${dir.name}/\`${suffix}\n`;
      }
    }

    // --- Framework-specific instructions ---
    const frameworkInstructions = getFrameworkInstructions(stacks);
    const stackSection = frameworkInstructions
      ? `\n## Stack-Specific Guidelines\n\n${frameworkInstructions}\n`
      : '';

    // --- TypeScript-specific additions ---
    let tsSection = '';
    if (hasTS) {
      const tsconfig = ctx.jsonFile('tsconfig.json');
      if (tsconfig) {
        const strict = tsconfig.compilerOptions && tsconfig.compilerOptions.strict;
        tsSection = `
## TypeScript Configuration
- Strict mode: ${strict ? '**enabled**' : '**disabled** (consider enabling)'}
- Always fix type errors before committing — do not use \`@ts-ignore\`
- Run type checking: \`${scripts.typecheck ? 'npm run typecheck' : 'npx tsc --noEmit'}\`
`;
      }
    }

    // --- Dependency-specific guidelines ---
    const depGuidelines = detectDependencies(ctx);
    const depSection = depGuidelines.length > 0 ? `
## Key Dependencies
${depGuidelines.join('\n')}
` : '';

    // --- Verification criteria based on detected commands ---
    const verificationSteps = [];
    verificationSteps.push('1. All existing tests still pass');
    verificationSteps.push('2. New code has test coverage');
    if (scripts.lint || hasPython) {
      verificationSteps.push(`3. No linting errors (\`${scripts.lint ? 'npm run lint' : 'ruff check .'}\`)`);
    } else if (hasJS) {
      verificationSteps.push('3. No linting errors (`npx eslint .`)');
    } else {
      verificationSteps.push('3. No linting errors introduced');
    }
    if (scripts.build) {
      verificationSteps.push(`4. Build succeeds (\`npm run build\`)`);
    }
    if (hasTS) {
      verificationSteps.push(`${verificationSteps.length + 1}. No TypeScript errors (\`${scripts.typecheck ? 'npm run typecheck' : 'npx tsc --noEmit'}\`)`);
    }
    verificationSteps.push(`${verificationSteps.length + 1}. Changes match the requested scope (no gold-plating)`);

    // --- Read package.json for project name/description ---
    const pkg = ctx.jsonFile('package.json');
    const projectName = (pkg && pkg.name) ? pkg.name : path.basename(ctx.dir);
    const projectDesc = (pkg && pkg.description) ? ` — ${pkg.description}` : '';

    // --- Assemble the final CLAUDE.md ---
    return `# ${projectName}${projectDesc}

## Architecture
${mermaid}
${dirDescription}
## Stack
${stackNames}
${stackSection}${tsSection}${depSection}
## Build & Test
\`\`\`bash
${buildSection}
\`\`\`

## Code Style
- Follow existing patterns in the codebase
- Write tests for new features
- Keep functions small and focused (< 50 lines)
- Use descriptive variable names; avoid abbreviations

<constraints>
- Never commit secrets, API keys, or .env files
- Always run tests before marking work complete
- Prefer editing existing files over creating new ones
- When uncertain about architecture, ask before implementing
${hasTS ? '- Do not use @ts-ignore or @ts-expect-error without a tracking issue\n' : ''}\
${hasJS ? '- Use const by default; never use var\n' : ''}\
</constraints>

<verification>
Before completing any task, confirm:
${verificationSteps.join('\n')}
</verification>

## Workflow
- Verify changes with tests before committing
- Use descriptive commit messages (why, not what)
- Create focused PRs — one concern per PR
- Document non-obvious decisions in code comments

---
*Generated by [claudex-setup](https://github.com/DnaFin/claudex-setup) v${require('../package.json').version} on ${new Date().toISOString().split('T')[0]}. Customize this file for your project — a hand-crafted CLAUDE.md will always be better than a generated one.*
`;
  },

  'hooks': () => ({
    'on-edit-lint.sh': `#!/bin/bash
# PostToolUse hook - runs linter after file edits
# Detects which linter is available and runs it

if command -v npx &>/dev/null; then
  if [ -f "package.json" ] && grep -q '"lint"' package.json 2>/dev/null; then
    npm run lint --silent 2>/dev/null
  elif [ -f ".eslintrc" ] || [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f "eslint.config.js" ]; then
    npx eslint --fix . --quiet 2>/dev/null
  fi
elif command -v ruff &>/dev/null; then
  ruff check --fix . 2>/dev/null
fi
`,
    'protect-secrets.sh': `#!/bin/bash
# PreToolUse hook - blocks reads of secret files
INPUT=$(cat -)
FILE_PATH=$(echo "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p')

if echo "$FILE_PATH" | grep -qiE '\\.env$|\\.env\\.|secrets/|credentials|\\.pem$|\\.key$'; then
  echo '{"decision": "block", "reason": "Blocked: accessing secret/credential files is not allowed."}'
  exit 0
fi
echo '{"decision": "allow"}'
`,
    'log-changes.sh': `#!/bin/bash
# PostToolUse hook - logs all file changes with timestamps
# Appends to .claude/logs/file-changes.log

INPUT=$(cat -)
TOOL_NAME=$(echo "$INPUT" | sed -n 's/.*"tool_name"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p')
TOOL_NAME=\${TOOL_NAME:-unknown}
FILE_PATH=$(echo "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

LOG_DIR=".claude/logs"
LOG_FILE="$LOG_DIR/file-changes.log"

mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
echo "[$TIMESTAMP] $TOOL_NAME: $FILE_PATH" >> "$LOG_FILE"

exit 0
`,
  }),

  'commands': (stacks) => {
    const stackKeys = stacks.map(s => s.key);
    const isNext = stackKeys.includes('nextjs');
    const isDjango = stackKeys.includes('django');
    const isFastApi = stackKeys.includes('fastapi');
    const isPython = stackKeys.includes('python') || isDjango || isFastApi;
    const hasDocker = stackKeys.includes('docker');

    const cmds = {};

    // Test command - stack-specific
    if (isNext) {
      cmds['test.md'] = `Run the test suite for this Next.js project.

## Steps:
1. Run \`npm test\` (or \`npx vitest run\`)
2. If tests fail, check for missing mocks or async issues
3. For component tests, ensure React Testing Library patterns are used
4. For API route tests, check request/response handling
5. Report: total, passed, failed, coverage if available
`;
    } else if (isPython) {
      cmds['test.md'] = `Run the test suite for this Python project.

## Steps:
1. Run \`python -m pytest -v\` (or the project's test command)
2. Check for fixture issues, missing test database, or import errors
3. If using Django: \`python manage.py test\`
4. Report: total, passed, failed, and any tracebacks
`;
    } else {
      cmds['test.md'] = `Run the test suite and report results.

## Steps:
1. Run the project's test command
2. If tests fail, analyze the failures
3. Report: total, passed, failed, and any error details
`;
    }

    // Review - always generic (works well as-is)
    cmds['review.md'] = `Review the current changes for quality and correctness.

## Steps:
1. Run \`git diff\` to see all changes
2. Check for: bugs, security issues, missing tests, code style
3. Provide actionable feedback
`;

    // Deploy - stack-specific
    if (isNext) {
      cmds['deploy.md'] = `Pre-deployment checklist for Next.js.

## Pre-deploy:
1. Run \`git status\` — working tree must be clean
2. Run \`npm run build\` — must succeed with no errors
3. Run \`npm test\` — all tests pass
4. Run \`npm run lint\` — no lint errors
5. Check for \`console.log\` in production code
6. Verify environment variables are set in deployment platform

## Deploy:
1. If Vercel: \`git push\` triggers auto-deploy
2. If self-hosted: \`npm run build && npm start\`
3. Verify: check /api/health or main page loads
4. Tag: \`git tag -a vX.Y.Z -m "Release vX.Y.Z"\`
`;
    } else if (hasDocker) {
      cmds['deploy.md'] = `Pre-deployment checklist with Docker.

## Pre-deploy:
1. Run \`git status\` — working tree must be clean
2. Run full test suite — all tests pass
3. Run \`docker build -t app .\` — must succeed
4. Run \`docker run app\` locally — smoke test

## Deploy:
1. Build: \`docker build -t registry/app:latest .\`
2. Push: \`docker push registry/app:latest\`
3. Deploy to target environment
4. Verify health endpoint responds
5. Tag: \`git tag -a vX.Y.Z -m "Release vX.Y.Z"\`
`;
    } else {
      cmds['deploy.md'] = `Pre-deployment checklist.

## Pre-deploy:
1. Run \`git status\` — working tree must be clean
2. Run full test suite — all tests must pass
3. Run linter — no errors
4. Verify no secrets in staged changes
5. Review diff since last deploy

## Deploy:
1. Confirm target environment
2. Run deployment command
3. Verify deployment (health check)
4. Tag: \`git tag -a vX.Y.Z -m "Release vX.Y.Z"\`
`;
    }

    // Fix - always generic with $ARGUMENTS
    cmds['fix.md'] = `Fix the issue described: $ARGUMENTS

## Steps:
1. Understand the issue — read relevant code and error messages
2. Identify the root cause (not just the symptom)
3. Implement the minimal fix
4. Write or update tests to cover the fix
5. Run the full test suite to verify no regressions
6. Summarize what was wrong and how the fix addresses it
`;

    // Stack-specific bonus commands
    if (isNext) {
      cmds['check-build.md'] = `Run Next.js build check without deploying.

1. Run \`npx next build\`
2. Check for: TypeScript errors, missing pages, broken imports
3. Verify no "Dynamic server usage" errors in static pages
4. Report build output size and any warnings
`;
    }

    if (isPython && (isDjango || isFastApi)) {
      cmds['migrate.md'] = `Run database migrations safely.

1. Check current migration status${isDjango ? ': `python manage.py showmigrations`' : ''}
2. Create new migration if schema changed${isDjango ? ': `python manage.py makemigrations`' : ''}
3. Review the generated migration file
4. Apply: ${isDjango ? '`python manage.py migrate`' : '`alembic upgrade head`'}
5. Verify: check that the app starts and queries work
`;
    }

    return cmds;
  },

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
  let skipped = 0;

  let failedWithTemplates = [];
  for (const [key, technique] of Object.entries(TECHNIQUES)) {
    if (technique.passed || technique.check(ctx)) continue;
    if (!technique.template) continue;
    failedWithTemplates.push({ key, technique });
  }

  // Filter by 'only' list if provided (interactive wizard selections)
  if (options.only && options.only.length > 0) {
    failedWithTemplates = failedWithTemplates.filter(r => options.only.includes(r.key));
  }

  for (const { key, technique } of failedWithTemplates) {

    const template = TEMPLATES[technique.template];
    if (!template) continue;

    // Pass ctx as second argument — only claude-md uses it
    const result = template(stacks, ctx);

    if (typeof result === 'string') {
      // Single file template (like CLAUDE.md)
      // Map technique keys to actual file paths
      const filePathMap = {
        'claudeMd': 'CLAUDE.md',
        'mermaidArchitecture': 'CLAUDE.md', // mermaid is part of CLAUDE.md, skip separate file
      };
      if (key === 'mermaidArchitecture') continue; // Mermaid is generated inside CLAUDE.md template
      const filePath = filePathMap[key] || key;
      const fullPath = path.join(options.dir, filePath);

      if (!fs.existsSync(fullPath)) {
        fs.writeFileSync(fullPath, result, 'utf8');
        console.log(`  \x1b[32m✅\x1b[0m Created ${filePath}`);
        created++;
      } else {
        console.log(`  \x1b[2m⏭️  Skipped ${filePath} (already exists — your version is kept)\x1b[0m`);
        skipped++;
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
        } else {
          skipped++;
        }
      }
    }
  }

  // Auto-register hooks in settings if hooks were created but no settings exist
  const hooksDir = path.join(options.dir, '.claude/hooks');
  const settingsPath = path.join(options.dir, '.claude/settings.json');
  if (fs.existsSync(hooksDir) && !fs.existsSync(settingsPath)) {
    const hookFiles = fs.readdirSync(hooksDir).filter(f => f.endsWith('.sh'));
    if (hookFiles.length > 0) {
      const settings = {
        hooks: {
          PostToolUse: [{
            matcher: "Write|Edit",
            hooks: hookFiles.filter(f => f !== 'protect-secrets.sh').map(f => ({
              type: "command",
              command: `bash .claude/hooks/${f}`,
              timeout: 10
            }))
          }]
        }
      };
      // Add protect-secrets as PreToolUse if it exists
      if (hookFiles.includes('protect-secrets.sh')) {
        settings.hooks.PreToolUse = [{
          matcher: "Read|Write|Edit",
          hooks: [{
            type: "command",
            command: "bash .claude/hooks/protect-secrets.sh",
            timeout: 5
          }]
        }];
      }
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      console.log(`  \x1b[32m✅\x1b[0m Created .claude/settings.json (hooks registered)`);
      created++;
    }
  }

  console.log('');
  if (created === 0 && skipped > 0) {
    console.log('  \x1b[32m✅\x1b[0m Your project is already well configured!');
    console.log(`  \x1b[2m  ${skipped} files already exist and were preserved.\x1b[0m`);
    console.log('  \x1b[2m  We never overwrite your existing config — your setup is kept.\x1b[0m');
  } else if (created > 0) {
    console.log(`  \x1b[1m${created} files created.\x1b[0m`);
    if (skipped > 0) {
      console.log(`  \x1b[2m${skipped} existing files preserved (not overwritten).\x1b[0m`);
    }
  }

  console.log('');
  console.log('  Run \x1b[1mnpx claudex-setup audit\x1b[0m to check your score.');
  console.log('');
}

module.exports = { setup };
