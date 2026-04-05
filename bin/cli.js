#!/usr/bin/env node

const { audit } = require('../src/audit');
const { setup } = require('../src/setup');
const { analyzeProject, printAnalysis, exportMarkdown } = require('../src/analyze');
const { buildProposalBundle, printProposalBundle, writePlanFile, applyProposalBundle, printApplyResult } = require('../src/plans');
const { getGovernanceSummary, printGovernanceSummary, ensureWritableProfile, renderGovernanceMarkdown } = require('../src/governance');
const { runBenchmark, printBenchmark, writeBenchmarkReport } = require('../src/benchmark');
const { writeSnapshotArtifact, recordRecommendationOutcome, formatRecommendationOutcomeSummary, getRecommendationOutcomeSummary } = require('../src/activity');
const { collectFeedback } = require('../src/feedback');
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
  outcome: 'feedback',
};
const KNOWN_COMMANDS = ['audit', 'setup', 'augment', 'suggest-only', 'plan', 'apply', 'governance', 'benchmark', 'deep-review', 'interactive', 'watch', 'badge', 'insights', 'history', 'compare', 'trend', 'scan', 'feedback', 'doctor', 'convert', 'migrate', 'help', 'version'];

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
  let profile = 'safe-write';
  let mcpPacks = [];
  let requireChecks = [];
  let feedbackKey = null;
  let feedbackStatus = null;
  let feedbackEffect = null;
  let feedbackNotes = null;
  let feedbackSource = null;
  let feedbackScoreDelta = null;
  let platform = 'claude';
  let format = null;
  let commandSet = false;
  let extraArgs = [];
  let convertFrom = null;
  let convertTo = null;
  let migrateFrom = null;
  let migrateTo = null;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg === '--threshold' || arg === '--out' || arg === '--plan' || arg === '--only' || arg === '--profile' || arg === '--mcp-pack' || arg === '--require' || arg === '--key' || arg === '--status' || arg === '--effect' || arg === '--notes' || arg === '--source' || arg === '--score-delta' || arg === '--platform' || arg === '--format' || arg === '--from' || arg === '--to') {
      const value = rawArgs[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value`);
      }
      if (arg === '--threshold') threshold = value;
      if (arg === '--out') out = value;
      if (arg === '--plan') planFile = value;
      if (arg === '--only') only = value.split(',').map(item => item.trim()).filter(Boolean);
      if (arg === '--profile') profile = value.trim();
      if (arg === '--mcp-pack') mcpPacks = value.split(',').map(item => item.trim()).filter(Boolean);
      if (arg === '--require') requireChecks = value.split(',').map(item => item.trim()).filter(Boolean);
      if (arg === '--key') feedbackKey = value.trim();
      if (arg === '--status') feedbackStatus = value.trim();
      if (arg === '--effect') feedbackEffect = value.trim();
      if (arg === '--notes') feedbackNotes = value;
      if (arg === '--source') feedbackSource = value.trim();
      if (arg === '--score-delta') feedbackScoreDelta = value.trim();
      if (arg === '--platform') platform = value.trim().toLowerCase();
      if (arg === '--format') format = value.trim().toLowerCase();
      if (arg === '--from') { convertFrom = value.trim(); migrateFrom = value.trim(); }
      if (arg === '--to') { convertTo = value.trim(); migrateTo = value.trim(); }
      i++;
      continue;
    }

    if (arg.startsWith('--require=')) {
      requireChecks = arg.split('=').slice(1).join('=').split(',').map(item => item.trim()).filter(Boolean);
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

    if (arg.startsWith('--profile=')) {
      profile = arg.split('=').slice(1).join('=').trim();
      continue;
    }

    if (arg.startsWith('--mcp-pack=')) {
      mcpPacks = arg.split('=').slice(1).join('=').split(',').map(item => item.trim()).filter(Boolean);
      continue;
    }

    if (arg.startsWith('--key=')) {
      feedbackKey = arg.split('=').slice(1).join('=').trim();
      continue;
    }

    if (arg.startsWith('--status=')) {
      feedbackStatus = arg.split('=').slice(1).join('=').trim();
      continue;
    }

    if (arg.startsWith('--effect=')) {
      feedbackEffect = arg.split('=').slice(1).join('=').trim();
      continue;
    }

    if (arg.startsWith('--notes=')) {
      feedbackNotes = arg.split('=').slice(1).join('=');
      continue;
    }

    if (arg.startsWith('--source=')) {
      feedbackSource = arg.split('=').slice(1).join('=').trim();
      continue;
    }

    if (arg.startsWith('--score-delta=')) {
      feedbackScoreDelta = arg.split('=').slice(1).join('=').trim();
      continue;
    }

    if (arg.startsWith('--platform=')) {
      platform = arg.split('=').slice(1).join('=').trim().toLowerCase();
      continue;
    }

    if (arg.startsWith('--format=')) {
      format = arg.split('=').slice(1).join('=').trim().toLowerCase();
      continue;
    }

    if (arg.startsWith('--')) {
      flags.push(arg);
      continue;
    }

    if (!commandSet) {
      command = arg;
      commandSet = true;
    } else {
      extraArgs.push(arg);
    }
  }

  const normalizedCommand = COMMAND_ALIASES[command] || command;

  return { flags, command, normalizedCommand, threshold, out, planFile, only, profile, mcpPacks, requireChecks, feedbackKey, feedbackStatus, feedbackEffect, feedbackNotes, feedbackSource, feedbackScoreDelta, platform, format, extraArgs, convertFrom, convertTo, migrateFrom, migrateTo };
}

const HELP = `
  nerviq v${version}
  Score your repo's Claude Code setup. Fix gaps safely. Benchmark the impact.

  Start here (read-only, nothing changes):
    npx nerviq                  Audit your project (10 seconds)
    npx nerviq --lite           Quick scan: top 3 gaps + next command
    npx nerviq --platform codex Audit your Codex repo setup
    npx nerviq --platform codex augment      Codex-aware advisory pass, no writes
    npx nerviq --platform codex suggest-only Structured Codex report, no writes
    npx nerviq augment          Repo-aware analysis, no writes
    npx nerviq suggest-only     Structured report, no writes

  Plan and apply (when you're ready to change things):
    npx nerviq plan             Export proposal bundles with previews
    npx nerviq apply            Apply proposals selectively with rollback
    npx nerviq setup            Generate starter-safe baseline
    npx nerviq setup --auto     Apply all generated files without prompts

  Track progress over time:
    npx nerviq history          Show score history from saved snapshots
    npx nerviq compare          Compare latest vs previous snapshot
    npx nerviq trend --out r.md Export trend report as markdown

  Multi-repo:
    npx nerviq scan dir1 dir2   Compare multiple repos side-by-side

  Advanced:
    npx nerviq governance       Permission profiles, hooks, policy packs
    npx nerviq benchmark        Before/after in isolated temp copy
    npx nerviq deep-review      AI-powered config review (opt-in, uses API)
    npx nerviq interactive      Step-by-step guided wizard
    npx nerviq watch            Live monitoring on config changes with cross-platform watch fallback
    npx nerviq badge            Generate shields.io badge markdown
    npx nerviq feedback         Record recommendation outcomes or show local outcome summary

  Utilities:
    npx nerviq doctor           Self-diagnostics: Node version, deps, freshness gates, platform detection
    npx nerviq convert --from claude --to codex   Convert config between platforms
    npx nerviq migrate --platform cursor --from v2 --to v3   Migrate platform config to newer version

  Options:
    --threshold N   Exit with code 1 if score is below N (useful for CI)
    --require A,B   Exit with code 1 if named checks fail (e.g. --require secretsProtection,permissionDeny)
    --out FILE      Write JSON or markdown output to a file
    --plan FILE     Load a previously exported plan file
    --only A,B      Limit plan/apply to selected proposal ids or technique keys
    --profile NAME  Choose permission profile (read-only, suggest-only, safe-write, power-user, internal-research)
    --mcp-pack A,B  Merge named MCP packs into generated settings (e.g. context7-docs,next-devtools)
    --key NAME      Recommendation key for feedback logging (e.g. permissionDeny)
    --status VALUE  Feedback status: accepted, rejected, deferred
    --effect VALUE  Feedback effect: positive, neutral, negative
    --notes TEXT    Short notes to store with a feedback event
    --source NAME   Source label for feedback event (default: manual-cli)
    --score-delta N Optional observed score delta tied to the outcome
    --platform NAME Choose platform surface (claude default, codex advisory/build preview)
    --format NAME   Output format for audit results (json, sarif)
    --feedback      After audit output, prompt "Was this helpful? (y/n)" for each displayed top action and save answers locally
    --snapshot      Save a normalized snapshot artifact under .claude/nerviq/snapshots/
    --lite          Show a short top-3 quick scan with one clear next command
    --dry-run       Preview apply without writing files
    --verbose       Show all recommendations (not just critical/high)
    --json          Output as JSON (for CI pipelines)
    --auto          Apply all generated setup files without prompting
    --insights      Enable anonymous usage insights (off by default)
    --help          Show this help
    --version       Show version

  Examples:
    npx nerviq
    npx nerviq --lite
    npx nerviq --platform codex
    npx nerviq --platform codex augment
    npx nerviq --platform codex suggest-only --json
    npx nerviq --platform codex setup
    npx nerviq --platform codex plan --out codex-plan.json
    npx nerviq --platform codex --format sarif
    npx nerviq --snapshot
    npx nerviq augment
    npx nerviq augment --snapshot
    npx nerviq suggest-only --json
    npx nerviq governance --snapshot
    npx nerviq plan --out claudex-plan.json
    npx nerviq plan --profile safe-write
    npx nerviq setup --mcp-pack context7-docs
    npx nerviq apply --plan claudex-plan.json --only hooks,commands
    npx nerviq apply --mcp-pack context7-docs,next-devtools --only hooks
    npx nerviq apply --profile power-user --only claude-md,hooks
    npx nerviq governance --json
    npx nerviq benchmark --out benchmark.md
    npx nerviq feedback
    npx nerviq feedback --key permissionDeny --status accepted --effect positive --score-delta 12
    npx nerviq --json --threshold 60
    npx nerviq setup --auto
    npx nerviq interactive

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
    lite: flags.includes('--lite'),
    snapshot: flags.includes('--snapshot'),
    feedback: flags.includes('--feedback'),
    dryRun: flags.includes('--dry-run'),
    threshold: parsed.threshold !== null ? Number(parsed.threshold) : null,
    out: parsed.out,
    planFile: parsed.planFile,
    only: parsed.only,
    profile: parsed.profile,
    mcpPacks: parsed.mcpPacks,
    require: parsed.requireChecks,
    platform: parsed.platform || 'claude',
    format: parsed.format || null,
    dir: process.cwd()
  };

  if (!['claude', 'codex'].includes(options.platform)) {
    console.error(`\n  Error: Unsupported platform '${options.platform}'. Use 'claude' or 'codex'.\n`);
    process.exit(1);
  }

  if (options.format !== null && !['json', 'sarif'].includes(options.format)) {
    console.error(`\n  Error: Unsupported format '${options.format}'. Use 'json' or 'sarif'.\n`);
    process.exit(1);
  }

  if (options.threshold !== null && (!Number.isFinite(options.threshold) || options.threshold < 0 || options.threshold > 100)) {
    console.error('\n  Error: --threshold must be a number between 0 and 100.\n');
    process.exit(1);
  }

  if (options.require && options.require.length > 0 && normalizedCommand !== 'audit' && !['audit', 'discover'].includes(command)) {
    console.error(`\n  Warning: --require is only supported with the audit command. Ignoring for '${normalizedCommand}'.\n`);
  }

  if (!KNOWN_COMMANDS.includes(normalizedCommand)) {
    const suggestion = suggestCommand(command);
    console.error(`\n  Error: Unknown command '${command}'.`);
    if (suggestion) {
      console.error(`  Did you mean '${suggestion}'?`);
    }
    console.error('  Run nerviq --help for usage.\n');
    process.exit(1);
  }

  if (!require('fs').existsSync(options.dir)) {
    console.error(`\n  Error: Directory not found: ${options.dir}`);
    console.error('  Run nerviq from inside your project directory.\n');
    process.exit(1);
  }

  if (['setup', 'apply', 'benchmark'].includes(normalizedCommand)) {
    try {
      ensureWritableProfile(options.profile, normalizedCommand, options.dryRun);
    } catch (err) {
      console.error(`\n  Error: ${err.message}\n`);
      process.exit(1);
    }
  }

  try {
    const FULL_COMMAND_SET = new Set([
      'audit', 'scan', 'badge', 'augment', 'suggest-only', 'setup', 'plan', 'apply',
      'governance', 'benchmark', 'deep-review', 'interactive', 'watch', 'insights',
      'history', 'compare', 'trend', 'feedback', 'help', 'version',
      // Harmony + Synergy (cross-platform)
      'harmony-audit', 'harmony-sync', 'harmony-drift', 'harmony-advise',
      'harmony-watch', 'harmony-governance', 'synergy-report',
    ]);

    if (options.platform === 'codex') {
      if (!FULL_COMMAND_SET.has(normalizedCommand)) {
        console.error(`\n  Error: '${normalizedCommand}' is not supported for --platform codex.`);
        console.error('  Available: ' + [...FULL_COMMAND_SET].filter(c => c !== 'help' && c !== 'version').join(', ') + '.');
        process.exit(1);
      }
    }

    if (options.platform === 'gemini') {
      if (!FULL_COMMAND_SET.has(normalizedCommand)) {
        console.error(`\n  Error: '${normalizedCommand}' is not supported for --platform gemini.`);
        console.error('  Available: ' + [...FULL_COMMAND_SET].filter(c => c !== 'help' && c !== 'version').join(', ') + '.');
        process.exit(1);
      }
    }

    if (options.platform === 'copilot') {
      if (!FULL_COMMAND_SET.has(normalizedCommand)) {
        console.error(`\n  Error: '${normalizedCommand}' is not supported for --platform copilot.`);
        console.error('  Available: ' + [...FULL_COMMAND_SET].filter(c => c !== 'help' && c !== 'version').join(', ') + '.');
        process.exit(1);
      }
    }

    if (options.platform === 'cursor') {
      if (!FULL_COMMAND_SET.has(normalizedCommand)) {
        console.error(`\n  Error: '${normalizedCommand}' is not supported for --platform cursor.`);
        console.error('  Available: ' + [...FULL_COMMAND_SET].filter(c => c !== 'help' && c !== 'version').join(', ') + '.');
        process.exit(1);
      }
    }

    for (const plat of ['windsurf', 'aider', 'opencode']) {
      if (options.platform === plat) {
        if (!FULL_COMMAND_SET.has(normalizedCommand)) {
          console.error(`\n  Error: '${normalizedCommand}' is not supported for --platform ${plat}.`);
          console.error('  Available: ' + [...FULL_COMMAND_SET].filter(c => c !== 'help' && c !== 'version').join(', ') + '.');
          process.exit(1);
        }
      }
    }

    if (normalizedCommand === 'scan') {
      const scanDirs = parsed.extraArgs;
      if (scanDirs.length === 0) {
        console.error('\n  Error: scan requires at least one directory argument.');
        console.error('  Usage: npx nerviq scan dir1 dir2 dir3\n');
        process.exit(1);
      }
      const fs = require('fs');
      const pathMod = require('path');
      const rows = [];
      for (const rawDir of scanDirs) {
        const dir = pathMod.resolve(rawDir);
        if (!fs.existsSync(dir)) {
          rows.push({ name: pathMod.basename(rawDir), dir: rawDir, score: null, passed: '-', failed: '-', suggested: '-', error: 'directory not found' });
          continue;
        }
        try {
          const result = await audit({ dir, silent: true, platform: options.platform });
          rows.push({
            name: pathMod.basename(dir),
            dir: rawDir,
            score: result.score,
            passed: result.passed,
            failed: result.failed,
            suggested: result.suggestedNextCommand || '-',
            error: null,
          });
        } catch (err) {
          rows.push({ name: pathMod.basename(dir), dir: rawDir, score: null, passed: '-', failed: '-', suggested: '-', error: err.message });
        }
      }

      if (options.json) {
        console.log(JSON.stringify(rows, null, 2));
      } else {
        // Find weakest
        const validRows = rows.filter(r => r.score !== null);
        const minScore = validRows.length > 0 ? Math.min(...validRows.map(r => r.score)) : null;
        const weakest = validRows.length > 1 && validRows.filter(r => r.score > minScore).length > 0
          ? validRows.find(r => r.score === minScore)
          : null;

        console.log('');
        console.log('\x1b[1m  nerviq multi-repo scan\x1b[0m');
        console.log('\x1b[2m  ═══════════════════════════════════════\x1b[0m');
        console.log('');

        // Table header
        const nameW = Math.max(8, ...rows.map(r => r.name.length)) + 2;
        const header = `  ${'Project'.padEnd(nameW)} ${'Score'.padStart(5)}  ${'Pass'.padStart(4)}  ${'Fail'.padStart(4)}  Suggested Command`;
        console.log('\x1b[1m' + header + '\x1b[0m');
        console.log('  ' + '─'.repeat(header.trim().length));

        for (const row of rows) {
          if (row.error) {
            console.log(`  ${row.name.padEnd(nameW)} \x1b[31m${('ERR').padStart(5)}\x1b[0m  ${String(row.passed).padStart(4)}  ${String(row.failed).padStart(4)}  ${row.error}`);
            continue;
          }
          const isWeak = weakest && row.name === weakest.name && row.dir === weakest.dir;
          const scoreColor = row.score >= 70 ? '\x1b[32m' : row.score >= 40 ? '\x1b[33m' : '\x1b[31m';
          const prefix = isWeak ? '\x1b[31m⚠ ' : '  ';
          const suffix = isWeak ? ' ← weakest\x1b[0m' : '';
          console.log(`${prefix}${row.name.padEnd(nameW)} ${scoreColor}${String(row.score).padStart(5)}\x1b[0m  ${String(row.passed).padStart(4)}  ${String(row.failed).padStart(4)}  ${row.suggested}${suffix}`);
        }
        console.log('');
      }
      process.exit(0);
    } else if (normalizedCommand === 'history') {
      const { formatHistory } = require('../src/activity');
      console.log('');
      console.log(formatHistory(options.dir));
      console.log('');
      process.exit(0);
    } else if (normalizedCommand === 'compare') {
      const { compareLatest } = require('../src/activity');
      const result = compareLatest(options.dir);
      if (!result) {
        console.log('\n  Need at least 2 snapshots to compare. Run `npx nerviq --snapshot` twice.\n');
        process.exit(0);
      }
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        const sign = result.delta.score >= 0 ? '+' : '';
        console.log('');
        console.log(`  Previous: ${result.previous.score}/100 (${result.previous.date?.split('T')[0]})`);
        console.log(`  Current:  ${result.current.score}/100 (${result.current.date?.split('T')[0]})`);
        console.log(`  Delta:    ${sign}${result.delta.score} points`);
        console.log(`  Trend:    ${result.trend}`);
        if (result.improvements.length > 0) console.log(`  Fixed:    ${result.improvements.join(', ')}`);
        if (result.regressions.length > 0) console.log(`  New gaps: ${result.regressions.join(', ')}`);
        console.log('');
      }
      process.exit(0);
    } else if (normalizedCommand === 'trend') {
      const { exportTrendReport } = require('../src/activity');
      const report = exportTrendReport(options.dir);
      if (!report) {
        console.log('\n  No snapshots found. Run `npx nerviq --snapshot` to start tracking.\n');
        process.exit(0);
      }
      if (options.out) {
        require('fs').writeFileSync(options.out, report, 'utf8');
        console.log(`\n  Trend report exported to ${options.out}\n`);
      } else {
        console.log(report);
      }
      process.exit(0);
    } else if (normalizedCommand === 'badge') {
      const { getBadgeMarkdown } = require('../src/badge');
      const result = await audit({ ...options, silent: true });
      console.log(getBadgeMarkdown(result.score));
      console.log('');
      console.log('Add this to your README.md');
      process.exit(0);
    } else if (normalizedCommand === 'insights') {
      const https = require('https');
      const url = 'https://claudex-insights.claudex.workers.dev/v1/stats';
      const req = https.get(url, (res) => {
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
            console.log('  No community data available yet. Be the first to run: npx nerviq');
          }
        });
      }).on('error', () => {
        console.log('  Could not reach insights server. Run locally: npx nerviq');
      });
      req.setTimeout(10000, () => {
        req.destroy();
        console.log('  Insights request timed out. Run locally: npx nerviq');
      });
      return; // keep process alive for http
    } else if (normalizedCommand === 'feedback') {
      if (parsed.feedbackKey) {
        if (!parsed.feedbackStatus) {
          console.error('\n  Error: feedback logging requires --status when --key is provided.\n');
          process.exit(1);
        }
        const artifact = recordRecommendationOutcome(options.dir, {
          key: parsed.feedbackKey,
          status: parsed.feedbackStatus,
          effect: parsed.feedbackEffect || 'neutral',
          notes: parsed.feedbackNotes || '',
          source: parsed.feedbackSource || 'manual-cli',
          scoreDelta: parsed.feedbackScoreDelta !== null ? Number(parsed.feedbackScoreDelta) : null,
        });
        const summary = getRecommendationOutcomeSummary(options.dir);
        if (options.json) {
          console.log(JSON.stringify({ artifact, summary }, null, 2));
        } else {
          console.log('');
          console.log(`  Feedback recorded for ${parsed.feedbackKey}`);
          console.log(`  Artifact: ${artifact.relativePath}`);
          console.log('');
          console.log(formatRecommendationOutcomeSummary(options.dir));
          console.log('');
        }
      } else {
        if (options.json) {
          console.log(JSON.stringify(getRecommendationOutcomeSummary(options.dir), null, 2));
        } else {
          console.log('');
          console.log(formatRecommendationOutcomeSummary(options.dir));
          console.log('');
        }
      }
      process.exit(0);
    } else if (normalizedCommand === 'augment' || normalizedCommand === 'suggest-only') {
      const report = await analyzeProject({ ...options, mode: normalizedCommand });
      const snapshot = options.snapshot ? writeSnapshotArtifact(options.dir, normalizedCommand, report, {
        sourceCommand: normalizedCommand,
      }) : null;
      if (options.out && !options.json) {
        const fs = require('fs');
        const md = exportMarkdown(report);
        fs.writeFileSync(options.out, md, 'utf8');
        console.log(`\n  Report exported to ${options.out}\n`);
      }
      printAnalysis(report, options);
      if (snapshot && !options.json) {
        console.log(`  Snapshot saved: ${snapshot.relativePath}`);
        console.log(`  Snapshot index: ${snapshot.indexPath}`);
        console.log('');
      }
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
      const fs = require('fs');
      const path = require('path');
      const summary = getGovernanceSummary(options.platform);
      if (options.out) {
        fs.mkdirSync(path.dirname(options.out), { recursive: true });
        const content = path.extname(options.out).toLowerCase() === '.md'
          ? renderGovernanceMarkdown(summary)
          : JSON.stringify(summary, null, 2);
        fs.writeFileSync(options.out, content, 'utf8');
      }
      printGovernanceSummary(summary, options);
      const snapshot = options.snapshot ? writeSnapshotArtifact(options.dir, 'governance', summary, {
        sourceCommand: normalizedCommand,
      }) : null;
      if (options.out && !options.json) {
        console.log(`  Governance report written to ${options.out}`);
        console.log('');
      }
      if (snapshot && !options.json) {
        console.log(`  Snapshot saved: ${snapshot.relativePath}`);
        console.log(`  Snapshot index: ${snapshot.indexPath}`);
        console.log('');
      }
    } else if (normalizedCommand === 'benchmark') {
      const report = await runBenchmark(options);
      const snapshot = options.snapshot ? writeSnapshotArtifact(options.dir, 'benchmark', report, {
        sourceCommand: normalizedCommand,
      }) : null;
      if (options.out) {
        writeBenchmarkReport(report, options.out);
      }
      printBenchmark(report, options);
      if (options.out && !options.json) {
        console.log(`  Benchmark report written to ${options.out}`);
        console.log('');
      }
      if (snapshot && !options.json) {
        console.log(`  Snapshot saved: ${snapshot.relativePath}`);
        console.log(`  Snapshot index: ${snapshot.indexPath}`);
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
    } else if (normalizedCommand === 'doctor') {
      const { runDoctor } = require('../src/doctor');
      const output = await runDoctor({ dir: options.dir, json: options.json, verbose: options.verbose });
      console.log(output);
      process.exit(0);
    } else if (normalizedCommand === 'convert') {
      const { runConvert } = require('../src/convert');
      const output = await runConvert({
        dir: options.dir,
        from: parsed.convertFrom,
        to: parsed.convertTo,
        dryRun: options.dryRun,
        json: options.json,
      });
      console.log(output);
      process.exit(0);
    } else if (normalizedCommand === 'migrate') {
      const { runMigrate } = require('../src/migrate');
      const output = await runMigrate({
        dir: options.dir,
        platform: options.platform || parsed.platform || 'claude',
        from: parsed.migrateFrom,
        to: parsed.migrateTo,
        dryRun: options.dryRun,
        json: options.json,
      });
      console.log(output);
      process.exit(0);
    } else if (normalizedCommand === 'setup') {
      await setup(options);
      if (options.snapshot) {
        const postSetupResult = await audit({ dir: options.dir, silent: true, platform: options.platform });
        const snapshot = writeSnapshotArtifact(options.dir, 'audit', postSetupResult, {
          sourceCommand: 'setup',
        });
        if (!options.json) {
          console.log(`  Snapshot saved: ${snapshot.relativePath}`);
        }
      }
    } else {
      const result = await audit(options);
      if (options.feedback && !options.json && options.format === null) {
        const feedbackTargets = options.lite
          ? (result.liteSummary?.topNextActions || [])
          : (result.topNextActions || []);
        const feedbackResult = await collectFeedback(options.dir, {
          findings: feedbackTargets,
          platform: result.platform,
          sourceCommand: normalizedCommand,
          score: result.score,
        });
        if (feedbackResult.mode === 'skipped-noninteractive') {
          console.log('  Feedback prompt skipped: interactive terminal required.');
          console.log('');
        } else if (feedbackResult.saved > 0) {
          console.log(`  Feedback saved: ${feedbackResult.relativeDir}`);
          console.log(`  Helpful: ${feedbackResult.helpful} | Not helpful: ${feedbackResult.unhelpful}`);
          console.log('');
        }
      }
      const snapshot = options.snapshot ? writeSnapshotArtifact(options.dir, 'audit', result, {
        sourceCommand: normalizedCommand,
      }) : null;
      if (snapshot && !options.json) {
        console.log(`  Snapshot saved: ${snapshot.relativePath}`);
        console.log(`  Snapshot index: ${snapshot.indexPath}`);
        console.log('');
      }
      if (options.threshold !== null && result.score < options.threshold) {
        if (!options.json) {
          console.error(`  Threshold failed: score ${result.score}/100 is below required ${options.threshold}/100.\n`);
        }
        process.exit(1);
      }
      if (options.require && options.require.length > 0) {
        const failedRequired = options.require.filter(key => {
          const check = result.results.find(r => r.key === key);
          return !check || check.passed !== true;
        });
        if (failedRequired.length > 0) {
          if (!options.json) {
            console.error(`\n  Required checks failed: ${failedRequired.join(', ')}`);
            console.error('  These must pass for CI to succeed.\n');
          }
          process.exit(1);
        }
      }
    }
  } catch (err) {
    console.error(`\n  Error: ${err.message}`);
    process.exit(1);
  }
}

main();
