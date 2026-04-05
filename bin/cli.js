#!/usr/bin/env node

const { audit } = require('../src/audit');
const { setup } = require('../src/setup');
const { analyzeProject, printAnalysis, exportMarkdown } = require('../src/analyze');
const { buildProposalBundle, printProposalBundle, writePlanFile, applyProposalBundle, printApplyResult } = require('../src/plans');
const { getGovernanceSummary, printGovernanceSummary, ensureWritableProfile, renderGovernanceMarkdown } = require('../src/governance');
const { runBenchmark, printBenchmark, writeBenchmarkReport } = require('../src/benchmark');
const { writeSnapshotArtifact, recordRecommendationOutcome, formatRecommendationOutcomeSummary, getRecommendationOutcomeSummary } = require('../src/activity');
const { collectFeedback } = require('../src/feedback');
const { startServer } = require('../src/server');
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
const KNOWN_COMMANDS = ['audit', 'setup', 'augment', 'suggest-only', 'plan', 'apply', 'governance', 'benchmark', 'deep-review', 'interactive', 'watch', 'badge', 'insights', 'history', 'compare', 'trend', 'scan', 'feedback', 'doctor', 'convert', 'migrate', 'catalog', 'certify', 'serve', 'help', 'version'];

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
  let port = null;
  let commandSet = false;
  let extraArgs = [];
  let convertFrom = null;
  let convertTo = null;
  let migrateFrom = null;
  let migrateTo = null;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg === '--threshold' || arg === '--out' || arg === '--plan' || arg === '--only' || arg === '--profile' || arg === '--mcp-pack' || arg === '--require' || arg === '--key' || arg === '--status' || arg === '--effect' || arg === '--notes' || arg === '--source' || arg === '--score-delta' || arg === '--platform' || arg === '--format' || arg === '--from' || arg === '--to' || arg === '--port') {
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
      if (arg === '--port') port = value.trim();
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

    if (arg.startsWith('--port=')) {
      port = arg.split('=').slice(1).join('=').trim();
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

  return { flags, command, normalizedCommand, threshold, out, planFile, only, profile, mcpPacks, requireChecks, feedbackKey, feedbackStatus, feedbackEffect, feedbackNotes, feedbackSource, feedbackScoreDelta, platform, format, port, extraArgs, convertFrom, convertTo, migrateFrom, migrateTo };
}

const HELP = `
  nerviq v${version}
  The intelligent nervous system for AI coding agents.
  Audit, align, and amplify every platform on every project.

  DISCOVER
    nerviq audit                  Score your project (0-100)
    nerviq audit --platform X     Audit specific platform (claude|codex|cursor|copilot|gemini|windsurf|aider|opencode)
    nerviq audit --lite           Quick scan: top 3 gaps + next command
    nerviq audit --json           Machine-readable JSON output (for CI)
    nerviq scan dir1 dir2         Compare multiple repos side-by-side
    nerviq catalog                Full check catalog (all 8 platforms)
    nerviq catalog --json         Export full check catalog as JSON

  SETUP
    nerviq setup                  Generate starter-safe baseline config files
    nerviq setup --auto           Apply all generated files without prompts
    nerviq interactive            Step-by-step guided wizard
    nerviq doctor                 Self-diagnostics: Node, deps, freshness, platform detection

  IMPROVE
    nerviq augment                Improvement plan (no writes)
    nerviq suggest-only           Structured report for sharing (no writes)
    nerviq plan                   Export proposal bundles with diffs
    nerviq plan --out plan.json   Save plan to file
    nerviq apply                  Apply proposals selectively with rollback
    nerviq apply --dry-run        Preview changes without writing

  GOVERN
    nerviq governance             Permission profiles + hooks + policy packs
    nerviq governance --json      Machine-readable governance summary
    nerviq benchmark              Before/after score in isolated temp copy
    nerviq certify                Generate certification badge for your project

  CROSS-PLATFORM
    nerviq harmony-audit          Drift detection across all active platforms
    nerviq synergy-report         Multi-agent amplification opportunities
    nerviq convert --from X --to Y   Convert configs between platforms
    nerviq migrate --platform X   Platform version migration helper
    nerviq migrate --platform cursor --from v2 --to v3

  MONITOR
    nerviq watch                  Live config monitoring (re-audits on file change)
    nerviq history                Score history from saved snapshots
    nerviq compare                Latest vs previous snapshot diff
    nerviq trend                  Score trend over time
    nerviq trend --out report.md  Export trend report as markdown
    nerviq feedback               Record recommendation outcomes

  ADVANCED
    nerviq deep-review            AI-powered config review (opt-in, uses API key)
    nerviq serve --port 3000      Start local Nerviq REST API server
    nerviq badge                  Generate shields.io badge markdown

  OPTIONS
    --platform NAME   Platform: claude (default), codex, cursor, copilot, gemini, windsurf, aider, opencode
    --threshold N     Exit code 1 if score < N  (CI gate)
    --require A,B     Exit code 1 if named checks fail
    --out FILE        Write output to file (JSON or markdown)
    --plan FILE       Load previously exported plan file
    --only A,B        Limit plan/apply to selected proposal IDs
    --profile NAME    Permission profile: read-only | suggest-only | safe-write | power-user
    --mcp-pack A,B    Merge MCP packs into setup (e.g. context7-docs,next-devtools)
    --format NAME     Output format: json | sarif
    --port N          Port for \`serve\` (default: 3000)
    --snapshot        Save snapshot artifact under .claude/nerviq/snapshots/
    --lite            Short top-3 scan with one clear next step
    --dry-run         Preview changes without writing files
    --verbose         Show all checks (not just critical/high)
    --json            Output as JSON
    --auto            Apply all generated files without prompting
    --key NAME        Feedback: recommendation key (e.g. permissionDeny)
    --status VALUE    Feedback: accepted | rejected | deferred
    --effect VALUE    Feedback: positive | neutral | negative
    --score-delta N   Feedback: observed score delta
    --help            Show this help
    --version         Show version

  EXAMPLES
    npx nerviq
    npx nerviq --lite
    npx nerviq --platform cursor
    npx nerviq --platform codex augment
    npx nerviq scan ./app ./api ./infra
    npx nerviq harmony-audit
    npx nerviq convert --from claude --to codex
    npx nerviq migrate --platform cursor --from v2 --to v3
    npx nerviq setup --mcp-pack context7-docs
    npx nerviq apply --plan plan.json --only hooks,commands
    npx nerviq serve --port 4000
    npx nerviq --json --threshold 70
    npx nerviq catalog --json --out catalog.json
    npx nerviq feedback --key permissionDeny --status accepted --effect positive

  EXIT CODES
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
    port: parsed.port !== null ? Number(parsed.port) : null,
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

  if (options.port !== null && (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535)) {
    console.error('\n  Error: --port must be an integer between 0 and 65535.\n');
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
      'history', 'compare', 'trend', 'feedback', 'catalog', 'certify', 'serve', 'help', 'version',
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
    } else if (normalizedCommand === 'catalog') {
      const { generateCatalog, writeCatalogJson } = require('../src/catalog');
      if (options.out) {
        const result = writeCatalogJson(options.out);
        if (options.json) {
          console.log(JSON.stringify({ path: result.path, count: result.count }));
        } else {
          console.log(`\n  Catalog written to ${result.path} (${result.count} checks)\n`);
        }
      } else {
        const catalog = generateCatalog();
        if (options.json) {
          console.log(JSON.stringify(catalog, null, 2));
        } else {
          // Print summary table
          const platforms = {};
          for (const entry of catalog) {
            platforms[entry.platform] = (platforms[entry.platform] || 0) + 1;
          }
          console.log('');
          console.log('\x1b[1m  nerviq check catalog\x1b[0m');
          console.log('\x1b[2m  ═══════════════════════════════════════\x1b[0m');
          console.log(`  Total checks: \x1b[1m${catalog.length}\x1b[0m`);
          console.log('');
          for (const [plat, count] of Object.entries(platforms)) {
            console.log(`    ${plat.padEnd(12)} ${count} checks`);
          }
          console.log('');
          console.log('  Use --json for full output or --out catalog.json to write file.');
          console.log('');
        }
      }
      process.exit(0);
    } else if (normalizedCommand === 'certify') {
      const { certifyProject, generateCertBadge } = require('../src/certification');
      const certResult = await certifyProject(options.dir);
      if (options.json) {
        console.log(JSON.stringify(certResult, null, 2));
      } else {
        console.log('');
        console.log('\x1b[1m  nerviq certification\x1b[0m');
        console.log('\x1b[2m  ═══════════════════════════════════════\x1b[0m');
        console.log('');
        console.log(`  Level: \x1b[1m${certResult.level}\x1b[0m`);
        console.log(`  Harmony Score: ${certResult.harmonyScore}/100`);
        console.log('');
        if (Object.keys(certResult.platformScores).length > 0) {
          console.log('  Platform Scores:');
          for (const [plat, score] of Object.entries(certResult.platformScores)) {
            const scoreColor = score >= 70 ? '\x1b[32m' : score >= 40 ? '\x1b[33m' : '\x1b[31m';
            console.log(`    ${plat.padEnd(12)} ${scoreColor}${score}/100\x1b[0m`);
          }
          console.log('');
        }
        console.log('  Badge:');
        console.log(`  ${certResult.badge}`);
        console.log('');
        console.log('  Add the badge to your README.md');
        console.log('');
      }
      process.exit(0);
    } else if (normalizedCommand === 'serve') {
      const server = await startServer({
        port: options.port == null ? 3000 : options.port,
        baseDir: options.dir,
      });
      const address = server.address();
      const resolvedPort = address && typeof address === 'object' ? address.port : options.port;
      console.log('');
      console.log(`  nerviq API listening on http://127.0.0.1:${resolvedPort}`);
      console.log('  Endpoints: /api/health, /api/catalog, /api/audit, /api/harmony');
      console.log('');

      const closeServer = () => {
        server.close(() => process.exit(0));
      };

      process.on('SIGINT', closeServer);
      process.on('SIGTERM', closeServer);
      return;
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
