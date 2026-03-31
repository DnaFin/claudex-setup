#!/usr/bin/env node

const { audit } = require('../src/audit');
const { setup } = require('../src/setup');
const { version } = require('../package.json');

const args = process.argv.slice(2);
const command = args[0] || 'audit';
const flags = args.filter(a => a.startsWith('--'));

const HELP = `
  claudex-setup v${version}
  Audit and optimize any project for Claude Code.
  Powered by 1,107 verified techniques.

  Usage:
    npx claudex-setup                  Run audit on current directory
    npx claudex-setup audit            Same as above
    npx claudex-setup setup            Apply recommended configuration
    npx claudex-setup setup --auto     Apply all without prompts
    npx claudex-setup interactive      Step-by-step guided wizard
    npx claudex-setup watch            Monitor changes and re-audit live
    npx claudex-setup badge            Generate shields.io badge markdown

  Options:
    --verbose       Show all recommendations (not just critical/high)
    --json          Output as JSON (for CI pipelines)
    --no-insights   Disable anonymous usage insights
    --help          Show this help
    --version       Show version
`;

async function main() {
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
    dir: process.cwd()
  };

  try {
    if (command === 'badge') {
      const { getBadgeMarkdown } = require('../src/badge');
      const result = await audit({ ...options, silent: true });
      console.log(getBadgeMarkdown(result.score));
      console.log('');
      console.log('Add this to your README.md');
      process.exit(0);
    } else if (command === 'insights' || command === 'learn') {
      const https = require('https');
      const url = 'https://claudex-insights.dnafin.workers.dev/v1/stats';
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
    } else if (command === 'interactive' || command === 'wizard') {
      const { interactive } = require('../src/interactive');
      await interactive(options);
    } else if (command === 'watch') {
      const { watch } = require('../src/watch');
      await watch(options);
    } else if (command === 'setup') {
      await setup(options);
    } else {
      await audit(options);
    }
  } catch (err) {
    console.error(`\n  Error: ${err.message}`);
    process.exit(1);
  }
}

main();
