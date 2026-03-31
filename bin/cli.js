#!/usr/bin/env node

const { audit } = require('../src/audit');
const { setup } = require('../src/setup');
const { analyzeProject, printAnalysis } = require('../src/analyze');
const { buildProposalBundle, printProposalBundle, writePlanFile, applyProposalBundle, printApplyResult } = require('../src/plans');
const { getGovernanceSummary, printGovernanceSummary } = require('../src/governance');
const { runBenchmark, printBenchmark, writeBenchmarkReport } = require('../src/benchmark');
const { version } = require('../package.json');

const args = process.argv.slice(2);
const COMMAND_ALIASES = {
  review: 'deep-review',
  wizard: 'interactive',
  learn: 'insights',
  discover: 'audit',
  starter: 'setup',
  suggest: 'suggest-only',
  gov: 'governance',
};
const KNOWN_COMMANDS = ['audit', 'setup', 'augment', 'suggest-only', 'plan', 'apply', 'governance', 'benchmark', 'deep-review', 'interactive', 'watch', 'badge', 'insights', 'help', 'version'];

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function suggestCommand(input) {
  const candidates = [...KNOWN_COMMANDS, ...Object.keys(COMMAND_ALIASES)];
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = levenshtein(input, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return bestDistance <= 3 ? best : null;
}

function parseArgs(rawArgs) {
  const flags = [];
  let command = 'audit';
  let threshold = null;
  let out = null;
  let planFile = null;
  let only = [];
  let commandSet = false;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg === '--threshold' || arg === '--out' || arg === '--plan' || arg === '--only') {
      const value = rawArgs[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value`);
      }
      if (arg === '--threshold') threshold = value;
      if (arg === '--out') out = value;
      if (arg === '--plan') planFile = value;
      if (arg === '--only') only = value.split(',').map(item => item.trim()).filter(Boolean);
      i++;
      continue;
    }

    if (arg.startsWith('--threshold=')) {
      threshold = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--out=')) {
      out = arg.split('=').slice(1).join('=');
      continue;
    }

    if (arg.startsWith('--plan=')) {
      planFile = arg.split('=').slice(1).join('=');
      continue;
    }

    if (arg.startsWith('--only=')) {
      only = arg.split('=').slice(1).join('=').split(',').map(item => item.trim()).filter(Boolean);
      continue;
    }

    if (arg.startsWith('--')) {
      flags.push(arg);
      continue;
    }

    if (!commandSet) {
      command = arg;
      commandSet = true;
    }
  }

  const normalizedCommand = COMMAND_ALIASES[command] || command;

  return { flags, command, normalizedCommand, threshold, out, planFile, only };
}

const HELP = `
  claudex-setup v${version}
  Audit and optimize any project for Claude Code.
  Backed by research from 1,107 cataloged Claude Code entries.

  Usage:
    npx claudex-setup                  Run audit on current directory
    npx claudex-setup discover         Discover the highest-value improvements
    npx claudex-setup audit            Same as above
    npx claudex-setup starter          Alias for setup
    npx claudex-setup setup            Apply recommended configuration
    npx claudex-setup setup --auto     Apply all without prompts
    npx claudex-setup augment          Repo-aware augment plan (no writes)
    npx claudex-setup suggest-only     Structured suggestion report (no writes)
    npx claudex-setup plan             Exportable proposal bundles with file previews
    npx claudex-setup apply            Apply ready proposal bundles with rollback manifest
    npx claudex-setup governance       Profiles, hooks, and pilot rollout guidance
    npx claudex-setup benchmark        Measure before/after impact in an isolated temp copy
    npx claudex-setup deep-review      AI-powered config review (uses Claude Code or API key)
    npx claudex-setup interactive      Step-by-step guided wizard
    npx claudex-setup watch            Monitor changes and re-audit live
    npx claudex-setup badge            Generate shields.io badge markdown

  Options:
    --threshold N   Exit with code 1 if score is below N (useful for CI)
    --out FILE      Write JSON or markdown output to a file
    --plan FILE     Load a previously exported plan file
    --only A,B      Limit plan/apply to selected proposal ids or technique keys
    --dry-run       Preview apply without writing files
    --verbose       Show all recommendations (not just critical/high)
    --json          Output as JSON (for CI pipelines)
    --auto          Apply all generated setup files without prompting
    --insights      Enable anonymous usage insights (off by default)
    --help          Show this help
    --version       Show version

  Examples:
    npx claudex-setup
    npx claudex-setup augment
    npx claudex-setup suggest-only --json
    npx claudex-setup plan --out claudex-plan.json
    npx claudex-setup apply --plan claudex-plan.json --only hooks,commands
    npx claudex-setup governance --json
    npx claudex-setup benchmark --out benchmark.md
    npx claudex-setup --json --threshold 60
    npx claudex-setup setup --auto
    npx claudex-setup interactive

  Exit codes:
    0  Success
    1  Error, unknown command, or score below --threshold
`;

async function main() {
  let parsed;
  try {
    parsed = parseArgs(args);
  } catch (err) {
    console.error(`\n  Error: ${err.message}\n`);
    process.exit(1);
  }

  const { flags, command, normalizedCommand } = parsed;

  if (flags.includes('--help') || command === 'help') {
    console.log(HELP);
    process.exit(0);
  }

  if (flags.includes('--version') || command === 'version') {
    console.log(version);
    process.exit(0);
  }

  const options = {
    verbose: flags.includes('--verbose'),
    json: flags.includes('--json'),
    auto: flags.includes('--auto'),
    dryRun: flags.includes('--dry-run'),
    threshold: parsed.threshold !== null ? Number(parsed.threshold) : null,
    out: parsed.out,
    planFile: parsed.planFile,
    only: parsed.only,
    dir: process.cwd()
  };

  if (options.threshold !== null && (!Number.isFinite(options.threshold) || options.threshold < 0 || options.threshold > 100)) {
    console.error('\n  Error: --threshold must be a number between 0 and 100.\n');
    process.exit(1);
  }

  if (!KNOWN_COMMANDS.includes(normalizedCommand)) {
    const suggestion = suggestCommand(command);
    console.error(`\n  Error: Unknown command '${command}'.`);
    if (suggestion) {
      console.error(`  Did you mean '${suggestion}'?`);
    }
    console.error('  Run claudex-setup --help for usage.\n');
    process.exit(1);
  }

  if (!require('fs').existsSync(options.dir)) {
    console.error(`\n  Error: Directory not found: ${options.dir}`);
    console.error('  Run claudex-setup from inside your project directory.\n');
    process.exit(1);
  }

  try {
    if (normalizedCommand === 'badge') {
      const { getBadgeMarkdown } = require('../src/badge');
      const result = await audit({ ...options, silent: true });
      console.log(getBadgeMarkdown(result.score));
      console.log('');
      console.log('Add this to your README.md');
      process.exit(0);
    } else if (normalizedCommand === 'insights') {
      const https = require('https');
      const url = 'https://claudex-insights.claudex.workers.dev/v1/stats';
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const stats = JSON.parse(data);
            console.log('');
            console.log('\x1b[1m  CLAUDEX Community Insights\x1b[0m');
            console.log('\x1b[2m  ═══════════════════════════════════════\x1b[0m');
            console.log(`  Total audits run: \x1b[1m${stats.totalRuns}\x1b[0m`);
            console.log(`  Average score: \x1b[1m${stats.averageScore}/100\x1b[0m`);
            console.log('');
            if (stats.topFailedChecks && stats.topFailedChecks.length > 0) {
              console.log('\x1b[33m  Most common gaps:\x1b[0m');
              for (const f of stats.topFailedChecks.slice(0, 5)) {
                console.log(`     ${f.pct}% miss: \x1b[1m${f.check}\x1b[0m`);
              }
              console.log('');
            }
            if (stats.topStacks && stats.topStacks.length > 0) {
              console.log('\x1b[36m  Popular stacks:\x1b[0m');
              console.log(`     ${stats.topStacks.map(s => s.stack).join(', ')}`);
            }
            console.log('');
          } catch (e) {
            console.log('  No community data available yet. Be the first to run: npx claudex-setup');
          }
        });
      }).on('error', () => {
        console.log('  Could not reach insights server. Run locally: npx claudex-setup');
      });
      return; // keep process alive for http
    } else if (normalizedCommand === 'augment' || normalizedCommand === 'suggest-only') {
      const report = await analyzeProject({ ...options, mode: normalizedCommand });
      printAnalysis(report, options);
    } else if (normalizedCommand === 'plan') {
      const bundle = await buildProposalBundle(options);
      let artifact = null;
      if (options.out) {
        artifact = writePlanFile(bundle, options.out);
      }
      printProposalBundle(bundle, options);
      if (options.out && !options.json) {
        console.log(`  Plan written to ${options.out}`);
        if (artifact) {
          console.log(`  Activity log: ${artifact.relativePath}`);
        }
        console.log('');
      }
    } else if (normalizedCommand === 'apply') {
      const result = await applyProposalBundle(options);
      printApplyResult(result, options);
    } else if (normalizedCommand === 'governance') {
      const summary = getGovernanceSummary();
      printGovernanceSummary(summary, options);
    } else if (normalizedCommand === 'benchmark') {
      const report = await runBenchmark(options);
      if (options.out) {
        writeBenchmarkReport(report, options.out);
      }
      printBenchmark(report, options);
      if (options.out && !options.json) {
        console.log(`  Benchmark report written to ${options.out}`);
        console.log('');
      }
    } else if (normalizedCommand === 'deep-review') {
      const { deepReview } = require('../src/deep-review');
      await deepReview(options);
    } else if (normalizedCommand === 'interactive') {
      const { interactive } = require('../src/interactive');
      await interactive(options);
    } else if (normalizedCommand === 'watch') {
      const { watch } = require('../src/watch');
      await watch(options);
    } else if (normalizedCommand === 'setup') {
      await setup(options);
    } else {
      const result = await audit(options);
      if (options.threshold !== null && result.score < options.threshold) {
        if (!options.json) {
          console.error(`  Threshold failed: score ${result.score}/100 is below required ${options.threshold}/100.\n`);
        }
        process.exit(1);
      }
    }
  } catch (err) {
    console.error(`\n  Error: ${err.message}`);
    process.exit(1);
  }
}

main();
